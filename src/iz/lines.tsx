import { useMemo, useState, type FormEvent } from 'react'
import { Check, LocateFixed, Pencil, RefreshCw } from 'lucide-react'
import MapCanvas, { type MapLine, type MapPoint } from '../MapCanvas'
import { Alert, Field, Loading, Modal, PageHead, useApp, useAsync } from './components'
import { izApi, type IZRecord } from './api'
import { translateError } from './i18n'
import { readTrace, type TraceData, type TracePoint } from './network-map'

type DrawMode = 'aller' | 'retour'

interface LineForm {
  id?: number
  code: string
  nom: string
  cooperativeId: string
  couleur: string
  trace: TraceData
}

interface StopForm {
  nom: string
  latitude: string
  longitude: string
  ordre: string
}

const emptyStop = (): StopForm => ({ nom: '', latitude: '', longitude: '', ordre: '' })

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function tracePoints(points: TracePoint[], sens: DrawMode, label: string): MapPoint[] {
  return points.map((point, index) => ({
    key: `${sens}-${index}`,
    label: `${label} ${index + 1}`,
    kind: 'trace',
    color: sens === 'aller' ? '#16a34a' : '#dc2626',
    latitude: point.latitude,
    longitude: point.longitude,
  }))
}

export function AdminLines() {
  const { t, lang, notify } = useApp()
  const linesState = useAsync(() => izApi.adminLines(), [])
  const coops = useAsync(() => izApi.adminCooperatives(), [])
  const [search, setSearch] = useState('')
  const [coopFilter, setCoopFilter] = useState('')
  const [lineFilter, setLineFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAllLines, setShowAllLines] = useState(true)
  const [showStops, setShowStops] = useState(true)
  const [form, setForm] = useState<LineForm | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null)
  const [editorCenter, setEditorCenter] = useState({ latitude: -19.865, longitude: 47.033 })
  const [editorZoom, setEditorZoom] = useState(13)
  const [editorBasemap, setEditorBasemap] = useState<'plan' | 'satellite'>('plan')
  const [mapCenter, setMapCenter] = useState({ latitude: -19.865, longitude: 47.033 })
  const [mapZoom, setMapZoom] = useState(13)
  const [mapBasemap, setMapBasemap] = useState<'plan' | 'satellite'>('plan')
  const [stopForm, setStopForm] = useState<StopForm>(emptyStop())
  const [editingStopId, setEditingStopId] = useState<number | null>(null)
  const [stopPickMode, setStopPickMode] = useState(false)
  const [busy, setBusy] = useState(false)

  const stopsState = useAsync(
    () => (selectedId ? izApi.adminStops(selectedId) : Promise.resolve<IZRecord[]>([])),
    [selectedId],
  )
  const allStopsState = useAsync<IZRecord[]>(async () => {
    const groups = await Promise.all((linesState.data ?? []).map(async (line): Promise<IZRecord[]> => {
      const stops = await izApi.adminStops(Number(line.id))
      return stops.map((stop): IZRecord => ({ ...stop, lineId: line.id, cooperativeCode: line.cooperativeCode }))
    }))
    return groups.flat()
  }, [linesState.data])

  const lines = linesState.data ?? []
  const coopsList = coops.data ?? []
  const selectedLine = lines.find((line) => Number(line.id) === selectedId) ?? null

  const filteredLines = useMemo(() => {
    const value = search.trim().toLocaleLowerCase()
    return lines.filter((line) => {
      if (coopFilter && String(line.cooperativeCode ?? '') !== coopFilter) return false
      if (lineFilter && String(line.id) !== lineFilter) return false
      if (!value) return true
      return [line.nom, line.code, line.cooperativeCode]
        .some((field) => String(field ?? '').toLocaleLowerCase().includes(value))
    })
  }, [lines, search, coopFilter, lineFilter])

  const mapLines = useMemo<MapLine[]>(() => {
    const source = showAllLines || !selectedLine ? lines : [selectedLine]
    const result: MapLine[] = []
    for (const line of source) {
      const trace = readTrace(line.trace)
      const color = String(line.couleur ?? '#2563eb')
      for (const [sens, points] of [['aller', trace.aller], ['retour', trace.retour]] as const) {
        if (points.length > 1) result.push({ key: `ligne-${line.id}-${sens}`, color, points })
      }
    }
    return result
  }, [lines, selectedLine, showAllLines])

  const mapPoints = useMemo<MapPoint[]>(() => {
    if (!showStops) return []
    const source = showAllLines || !selectedLine
      ? allStopsState.data ?? []
      : (allStopsState.data ?? []).filter((stop) => String(stop.lineId) === String(selectedId))
    return source.flatMap((stop) => {
      const latitude = asNumber(stop.latitude)
      const longitude = asNumber(stop.longitude)
      if (latitude === null || longitude === null) return []
      const line = lines.find((item) => String(item.id) === String(stop.lineId))
      return [{
        key: `arret-${stop.id}`,
        label: String(stop.nom ?? t('nmap.stopFallback')),
        kind: 'arret' as const,
        color: String(line?.couleur ?? '#2563eb'),
        latitude,
        longitude,
      }]
    })
  }, [allStopsState.data, lines, selectedId, selectedLine, showAllLines, showStops, t])

  const editorPoints = useMemo<MapPoint[]>(() => {
    if (!form) return []
    const existingStops = allStopsState.data ?? []
    const lineStops = form.id
      ? existingStops
        .filter((stop) => String(stop.lineId) === String(form.id))
        .flatMap((stop): MapPoint[] => {
          const latitude = asNumber(stop.latitude)
          const longitude = asNumber(stop.longitude)
          if (latitude === null || longitude === null) return []
          return [{
            key: `arret-${stop.id}`,
            label: String(stop.nom ?? t('nmap.stopFallback')),
            kind: 'arret' as const,
            color: form.couleur,
            latitude,
            longitude,
          }]
        })
      : []
    return [
      ...lineStops,
      ...tracePoints(form.trace.aller, 'aller', t('nmap.outbound')),
      ...tracePoints(form.trace.retour, 'retour', t('nmap.return')),
    ]
  }, [form, allStopsState.data, t])

  const editorLines = useMemo<MapLine[]>(() => {
    if (!form) return []
    const result: MapLine[] = []
    if (form.trace.aller.length > 1) result.push({ key: 'aller', color: '#16a34a', points: form.trace.aller })
    if (form.trace.retour.length > 1) result.push({ key: 'retour', color: '#dc2626', points: form.trace.retour })
    return result
  }, [form])

  function openEditor(line?: IZRecord) {
    const cooperative = coopsList.find((coop) => coop.code === line?.cooperativeCode)
    setForm({
      id: line ? Number(line.id) : undefined,
      code: line ? String(line.code) : `L${Date.now().toString().slice(-5)}`,
      nom: line ? String(line.nom ?? '') : '',
      cooperativeId: cooperative ? String(cooperative.id) : '',
      couleur: line ? String(line.couleur ?? '#2563eb') : '#2563eb',
      trace: readTrace(line?.trace),
    })
    setDrawMode(null)
    setEditorCenter({ latitude: -19.865, longitude: 47.033 })
  }

  function handleEditorClick(point: TracePoint) {
    if (!form) return
    // Sans étape choisie, le premier clic démarre directement le tracé de l'aller.
    const mode = drawMode ?? 'aller'
    if (!drawMode) setDrawMode('aller')
    setForm({
      ...form,
      trace: { ...form.trace, [mode]: [...form.trace[mode], point] },
    })
  }

  async function saveLine(event?: FormEvent) {
    event?.preventDefault()
    if (!form) return
    if (!form.nom.trim()) {
      notify(t('lines.nameRequired'), 'error')
      return
    }
    setBusy(true)
    try {
      const payload = {
        code: form.code,
        nom: form.nom.trim(),
        cooperativeId: form.cooperativeId ? Number(form.cooperativeId) : undefined,
        couleur: form.couleur,
        trace: form.trace,
        active: true,
      }
      if (form.id) await izApi.updateLine(form.id, payload)
      else await izApi.createLine(payload)
      notify(form.id ? t('lines.updated') : t('lines.created'), 'success')
      setForm(null)
      setDrawMode(null)
      await linesState.reload()
      await allStopsState.reload()
    } catch (error) {
      notify(translateError(lang, error, 'lines.saveFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteLine(line: IZRecord) {
    if (!window.confirm(t('lines.deleteConfirm', { name: String(line.nom) }))) return
    setBusy(true)
    try {
      await izApi.deleteLine(Number(line.id))
      if (selectedId === Number(line.id)) setSelectedId(null)
      notify(t('lines.deleted'), 'success')
      await linesState.reload()
      await allStopsState.reload()
    } catch (error) {
      notify(translateError(lang, error, 'lines.deleteFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  function openStop(stop?: IZRecord) {
    setEditingStopId(stop ? Number(stop.id) : null)
    setStopForm({
      nom: stop ? String(stop.nom ?? '') : '',
      latitude: stop ? String(stop.latitude ?? '') : '',
      longitude: stop ? String(stop.longitude ?? '') : '',
      ordre: stop ? String(stop.ordre ?? '') : '',
    })
    setStopPickMode(false)
    if (stop) {
      const latitude = asNumber(stop.latitude)
      const longitude = asNumber(stop.longitude)
      if (latitude !== null && longitude !== null) {
        setMapCenter({ latitude, longitude })
        setMapZoom(16)
      }
      requestAnimationFrame(() => {
        document.getElementById('stop-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }

  function toggleStopPickMode() {
    const next = !stopPickMode
    setStopPickMode(next)
    if (next) {
      // La carte de sélection est au-dessus du panneau : on l'amène à l'écran.
      requestAnimationFrame(() => {
        document.getElementById('lines-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }

  async function saveStop(event?: FormEvent) {
    event?.preventDefault()
    if (!selectedId) {
      notify(t('lines.selectLineFirst'), 'error')
      return
    }
    const latitude = asNumber(stopForm.latitude)
    const longitude = asNumber(stopForm.longitude)
    if (!stopForm.nom.trim() || latitude === null || longitude === null) {
      notify(t('lines.invalidStop'), 'error')
      return
    }
    setBusy(true)
    try {
      const payload = {
        lineId: selectedId,
        nom: stopForm.nom.trim(),
        latitude,
        longitude,
        ordre: stopForm.ordre ? Number(stopForm.ordre) : 0,
      }
      if (editingStopId) await izApi.updateStop(editingStopId, payload)
      else await izApi.createStop(payload)
      notify(editingStopId ? t('lines.stopUpdated') : t('lines.stopAdded'), 'success')
      setStopForm(emptyStop())
      setEditingStopId(null)
      setStopPickMode(false)
      await Promise.all([stopsState.reload(), allStopsState.reload(), linesState.reload()])
    } catch (error) {
      notify(translateError(lang, error, 'lines.saveFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteStop(stop: IZRecord) {
    if (!window.confirm(t('lines.stopDeleteConfirm', { name: String(stop.nom) }))) return
    setBusy(true)
    try {
      await izApi.deleteStop(Number(stop.id))
      notify(t('lines.stopDeleted'), 'success')
      await Promise.all([stopsState.reload(), allStopsState.reload(), linesState.reload()])
    } catch (error) {
      notify(translateError(lang, error, 'lines.deleteFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title={t('lines.title')}
        subtitle={t('lines.subtitle')}
        action={
          <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => openEditor()}>
            {t('lines.new')}
          </button>
        }
      />

      <div className="iz-map-stats">
        <div className="iz-map-stat"><span>{t('lines.total')}</span><strong>{lines.length}</strong></div>
        <div className="iz-map-stat"><span>{t('nav.coops')}</span><strong>{coopsList.length}</strong></div>
        <div className="iz-map-stat"><span>{t('lines.totalStops')}</span><strong>{allStopsState.data?.length ?? 0}</strong></div>
      </div>

      <div className="iz-line-toolbar">
        <label className="iz-field">
          <span className="iz-label">{t('lines.search')}</span>
          <input className="iz-input" placeholder={t('lines.searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="iz-field">
          <span className="iz-label">{t('search.allCoops')}</span>
          <select className="iz-select" value={coopFilter} onChange={(event) => setCoopFilter(event.target.value)}>
            <option value="">{t('search.allCoops')}</option>
            {coopsList.map((coop) => <option key={coop.id} value={String(coop.code)}>{String(coop.nom)}</option>)}
          </select>
        </label>
        <label className="iz-field">
          <span className="iz-label">{t('search.allLines')}</span>
          <select className="iz-select" value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}>
            <option value="">{t('search.allLines')}</option>
            {lines.map((line) => <option key={line.id} value={String(line.id)}>{String(line.nom)}</option>)}
          </select>
        </label>
        <button className="iz-btn iz-btn-outline" onClick={() => { setSearch(''); setCoopFilter(''); setLineFilter('') }}>{t('lines.reset')}</button>
        <button className="iz-btn iz-btn-ghost" onClick={() => linesState.reload()}><RefreshCw size={15} /> {t('lines.refresh')}</button>
      </div>

      {linesState.error && <Alert type="error">{linesState.error}</Alert>}
      {linesState.loading ? <Loading /> : (
        <div className="iz-line-grid">
          {filteredLines.map((line) => (
            <div className="iz-card iz-line-card" key={line.id}>
              <div className="iz-line-card-head">
                <div>
                  <strong style={{ fontSize: '1rem' }}>{String(line.nom)}</strong>
                  <div className="iz-line-card-stats">
                    <span className="iz-line-swatch" style={{ background: String(line.couleur ?? '#2563eb') }} />
                    <span>{String(line.code)}</span>
                  </div>
                </div>
                <span className="iz-chip">{String(line.cooperativeCode ?? '—')}</span>
              </div>
              <div className="iz-line-card-stats">
                <span><b>{Number(line.arrets ?? 0)}</b> {t('map.stops')}</span>
                <span><b>{Number(line.vehicules ?? 0)}</b> {t('coops.vehicles')}</span>
              </div>
              <div className="iz-line-card-actions">
                <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => { setSelectedId(Number(line.id)); setShowAllLines(false) }}>{t('lines.viewMap')}</button>
                <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => openEditor(line)}>{t('lines.edit')}</button>
                <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => {
                  setSelectedId(Number(line.id))
                  requestAnimationFrame(() => document.getElementById('stops-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                }}>{t('map.stops')}</button>
                <button className="iz-btn iz-btn-ghost iz-btn-sm" disabled={busy} onClick={() => void deleteLine(line)}>{t('lines.delete')}</button>
              </div>
            </div>
          ))}
          {!filteredLines.length && <p className="iz-muted">{t('lines.empty')}</p>}
        </div>
      )}

      <div className="iz-card" style={{ marginTop: 24 }}>
        <div className="iz-section-head">
          <div>
            <h2 style={{ fontSize: '1.1rem' }}>{t('lines.mapTitle')}</h2>
            <p className="iz-small iz-muted">{t('lines.mapSubtitle')}</p>
          </div>
          <div className="iz-flex iz-wrap">
            <label className="iz-check-row"><input type="checkbox" checked={showAllLines} onChange={(event) => setShowAllLines(event.target.checked)} /><span>{t('coops.lines')}</span></label>
            <label className="iz-check-row"><input type="checkbox" checked={showStops} onChange={(event) => setShowStops(event.target.checked)} /><span>{t('lines.showStops')}</span></label>
            <div className="iz-basemap-toggle">
              <button type="button" className={`iz-btn iz-btn-sm ${mapBasemap === 'plan' ? 'iz-btn-primary' : 'iz-btn-outline'}`} onClick={() => setMapBasemap('plan')}>{t('lines.plan')}</button>
              <button type="button" className={`iz-btn iz-btn-sm ${mapBasemap === 'satellite' ? 'iz-btn-primary' : 'iz-btn-outline'}`} onClick={() => setMapBasemap('satellite')}>{t('lines.satellite')}</button>
            </div>
            <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => { setSelectedId(null); setShowAllLines(true); setShowStops(true); setMapBasemap('plan') }}>{t('lines.reset')}</button>
          </div>
        </div>
        <div className="iz-map-layout" style={{ marginTop: 12 }}>
          <div className="iz-map-box" id="lines-map">
            <MapCanvas
              points={mapPoints}
              lines={mapLines}
              vehicle={null}
              follow={false}
              terrain={false}
              focus={null}
              selectedKey=""
              center={mapCenter}
              zoom={mapZoom}
              basemap={mapBasemap}
              viewMode="2d"
              night={false}
              onSelect={() => undefined}
              onMove={(nextCenter, nextZoom) => { setMapCenter(nextCenter); setMapZoom(nextZoom) }}
              onMapClick={stopPickMode ? (point) => setStopForm((current) => ({ ...current, latitude: String(point.latitude.toFixed(6)), longitude: String(point.longitude.toFixed(6)) })) : undefined}
              zoomLabels={{ group: t('map.zoomGroup'), zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut') }}
              mapLabel={t('map.canvasAria')}
            />
          </div>
          <aside>
            <h3 className="iz-map-section-title">{selectedLine ? String(selectedLine.nom) : t('search.allLines')}</h3>
            <div className="iz-map-list">
              {(showAllLines || !selectedLine ? lines : [selectedLine]).map((line) => (
                <button key={line.id} className={selectedId === Number(line.id) ? 'active' : ''} onClick={() => setSelectedId(Number(line.id))}>
                  <strong>{String(line.nom)}</strong>
                  <span className="iz-small iz-muted" style={{ display: 'block' }}>
                    {String(line.code)} · {t('lines.lineStops', { count: Number(line.arrets ?? 0) })}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {selectedId && (
        <div className="iz-card" id="stops-panel" style={{ marginTop: 24 }}>
          <div className="iz-section-head">
            <div>
              <h2 style={{ fontSize: '1.1rem' }}>{t('lines.stopsTitle', { line: selectedLine ? String(selectedLine.nom) : String(selectedId) })}</h2>
              <p className="iz-small iz-muted">{t('lines.stopsHelp')}</p>
            </div>
            <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setSelectedId(null)}>{t('common.close')}</button>
          </div>

          {editingStopId && (
            <div className="iz-route-step active" style={{ marginTop: 12 }}>
              {t('lines.editingStop', { name: stopForm.nom || '—' })}
              <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" style={{ marginLeft: 8 }} onClick={() => { setEditingStopId(null); setStopForm(emptyStop()) }}>
                {t('lines.cancelEdit')}
              </button>
            </div>
          )}

          <form id="stop-form" className="iz-form-grid" style={{ marginTop: 12 }} onSubmit={(event) => void saveStop(event)}>
            <Field label={t('lines.stopName')} full>
              <input className="iz-input" required value={stopForm.nom} onChange={(event) => setStopForm({ ...stopForm, nom: event.target.value })} placeholder={t('nmap.departurePlaceholder')} />
            </Field>
            <Field label={t('lines.latitude')}>
              <input className="iz-input" required type="number" step="any" value={stopForm.latitude} onChange={(event) => setStopForm({ ...stopForm, latitude: event.target.value })} />
            </Field>
            <Field label={t('lines.longitude')}>
              <input className="iz-input" required type="number" step="any" value={stopForm.longitude} onChange={(event) => setStopForm({ ...stopForm, longitude: event.target.value })} />
            </Field>
            <Field label={t('lines.order')}>
              <input className="iz-input" type="number" min="0" value={stopForm.ordre} onChange={(event) => setStopForm({ ...stopForm, ordre: event.target.value })} />
            </Field>
            <div className="iz-flex iz-wrap" style={{ alignItems: 'end' }}>
              <button type="button" className={`iz-btn ${stopPickMode ? 'iz-btn-primary' : 'iz-btn-outline'} iz-btn-sm`} onClick={toggleStopPickMode}>
                <LocateFixed size={15} /> {stopPickMode ? t('lines.clickMapNow') : t('lines.pickOnMap')}
              </button>
              <button type="submit" className="iz-btn iz-btn-primary iz-btn-sm" disabled={busy}>{editingStopId ? t('common.save') : t('lines.addStop')}</button>
              {editingStopId && <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => { setEditingStopId(null); setStopForm(emptyStop()) }}>{t('common.cancel')}</button>}
            </div>
          </form>

          {stopsState.loading ? <Loading /> : (
            <div style={{ marginTop: 16 }}>
              {stopsState.data?.map((stop) => (
                <div className="iz-stop-row" key={stop.id}>
                  <div>
                    <strong>{String(stop.nom)}</strong>
                    <small> · {Number(stop.latitude).toFixed(5)}, {Number(stop.longitude).toFixed(5)} · #{Number(stop.ordre ?? 0)}</small>
                  </div>
                  <div className="iz-flex">
                    <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => openStop(stop)}>{t('common.edit')}</button>
                    <button className="iz-btn iz-btn-ghost iz-btn-sm" disabled={busy} onClick={() => void deleteStop(stop)}>×</button>
                  </div>
                </div>
              ))}
              {!stopsState.data?.length && <p className="iz-muted iz-small">{t('lines.noStops')}</p>}
            </div>
          )}
        </div>
      )}

      {form && (
        <Modal
          wide
          title={`${form.id ? t('common.edit') : t('common.add')} — ${t('admin.lines')}`}
          onClose={() => { setForm(null); setDrawMode(null) }}
          footer={
            <>
              <button className="iz-btn iz-btn-outline" onClick={() => { setForm(null); setDrawMode(null) }}>{t('common.cancel')}</button>
              <button className="iz-btn iz-btn-primary" disabled={busy} onClick={(event) => void saveLine(event)}>{t('common.save')}</button>
            </>
          }
        >
          <form className="iz-form-grid" onSubmit={(event) => void saveLine(event)}>
            <Field label={t('search.line')} full>
              <input className="iz-input" required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} placeholder={t('lines.lineNamePlaceholder')} />
            </Field>
            <Field label={t('search.cooperative')} full>
              <select className="iz-select" value={form.cooperativeId} onChange={(event) => setForm({ ...form, cooperativeId: event.target.value })}>
                <option value="">{t('lines.chooseCoop')}</option>
                {coopsList.map((coop) => <option key={coop.id} value={String(coop.id)}>{String(coop.nom)}</option>)}
              </select>
            </Field>
            <Field label={t('lines.color')} full>
              <div className="iz-flex">
                <input type="color" value={form.couleur} onChange={(event) => setForm({ ...form, couleur: event.target.value })} />
                <input className="iz-input" value={form.couleur} onChange={(event) => setForm({ ...form, couleur: event.target.value })} />
              </div>
            </Field>

            <div className="full">
              <div className="iz-route-step active">{t('lines.routeDrawn', { count: form.trace.aller.length + form.trace.retour.length })}</div>
              <div className="iz-flex" style={{ marginBottom: 8 }}>
                <span className="iz-small iz-muted" style={{ marginRight: 8, alignSelf: 'center' }}>{t('lines.basemap')}</span>
                <div className="iz-basemap-toggle">
                  <button type="button" className={`iz-btn iz-btn-sm ${editorBasemap === 'plan' ? 'iz-btn-primary' : 'iz-btn-outline'}`} onClick={() => setEditorBasemap('plan')}>{t('lines.plan')}</button>
                  <button type="button" className={`iz-btn iz-btn-sm ${editorBasemap === 'satellite' ? 'iz-btn-primary' : 'iz-btn-outline'}`} onClick={() => setEditorBasemap('satellite')}>{t('lines.satellite')}</button>
                </div>
              </div>
              <div className="iz-route-editor">
                <div className="iz-route-map">
                  <MapCanvas
                    points={editorPoints}
                    lines={editorLines}
                    vehicle={null}
                    follow={false}
                    terrain={false}
                    focus={null}
                    selectedKey=""
                    center={editorCenter}
                    zoom={editorZoom}
                    basemap={editorBasemap}
                    viewMode="2d"
                    night={false}
                    onSelect={() => undefined}
                    onMove={(nextCenter, nextZoom) => { setEditorCenter(nextCenter); setEditorZoom(nextZoom) }}
                    onMapClick={handleEditorClick}
                    zoomLabels={{ group: t('map.zoomGroup'), zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut') }}
                    mapLabel={t('map.canvasAria')}
                  />
                </div>
                <div>
                  <div className={`iz-route-step${drawMode === 'aller' ? ' active' : ''}`}>
                    {t('lines.step1', { count: form.trace.aller.length })}
                  </div>
                  <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setDrawMode(drawMode === 'aller' ? null : 'aller')}>
                    {drawMode === 'aller' ? <Check size={15} /> : <Pencil size={15} />} {drawMode === 'aller' ? t('lines.finishOutbound') : t('lines.drawOutbound')}
                  </button>
                  <div className={`iz-route-step${drawMode === 'retour' ? ' active' : ''}`} style={{ marginTop: 10 }}>
                    {t('lines.step2', { count: form.trace.retour.length })}
                  </div>
                  <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setDrawMode(drawMode === 'retour' ? null : 'retour')}>
                    {drawMode === 'retour' ? <Check size={15} /> : <Pencil size={15} />} {drawMode === 'retour' ? t('lines.finishReturn') : t('lines.drawReturn')}
                  </button>
                  <div className="iz-route-actions">
                    <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" disabled={!drawMode || !form.trace[drawMode].length} onClick={() => {
                      if (!drawMode) return
                      setForm({ ...form, trace: { ...form.trace, [drawMode]: form.trace[drawMode].slice(0, -1) } })
                    }}>{t('lines.removeLast')}</button>
                    <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" disabled={!drawMode} onClick={() => {
                      if (!drawMode) return
                      setForm({ ...form, trace: { ...form.trace, [drawMode]: [] } })
                    }}>{t('lines.reset')}</button>
                  </div>
                  <p className="iz-small iz-muted" style={{ marginTop: 12 }}>
                    {drawMode
                      ? t('lines.clickAddPoints', { direction: drawMode === 'aller' ? t('nmap.outbound') : t('nmap.return') })
                      : t('lines.clickDrawStart')}
                  </p>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
