import { useState } from 'react'
import MapPage from './MapPage'
import BusMapPage from './BusMapPage'
import './MapHub.css'

interface Props {
  canEdit: boolean
}

/** Page Carte unifiee : transports/scans/signalements + lignes et arrets de bus. */
export default function MapHub({ canEdit }: Props) {
  const [vue, setVue] = useState<'transports' | 'lignes'>('transports')
  return (
    <div className="map-hub">
      <div className="map-hub__tabs" role="tablist" aria-label="Vues de la carte">
        <button
          type="button"
          role="tab"
          aria-selected={vue === 'transports'}
          className={vue === 'transports' ? 'active' : ''}
          onClick={() => setVue('transports')}
        >
          Transports, scans &amp; signalements
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vue === 'lignes'}
          className={vue === 'lignes' ? 'active' : ''}
          onClick={() => setVue('lignes')}
        >
          Lignes &amp; arrêts de bus
        </button>
      </div>
      {vue === 'transports' ? <MapPage /> : <BusMapPage canEdit={canEdit} />}
    </div>
  )
}
