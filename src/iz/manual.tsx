import { PageHead, useApp } from './components'

interface Section {
  title: string
  points: string[]
}

function useSections(scope: 'controle' | 'admin') {
  const { t, user } = useApp()
  const isSuper = user?.role === 'superadmin'
  const shared: Section[] = [
    {
      title: t('manual.s1Title'),
      points: [t('manual.s1p1'), t('manual.s1p2'), t('manual.s1p3'), t('manual.s1p4'), t('manual.s1p5')],
    },
  ]
  const controleur: Section[] = [
    {
      title: t('manual.c1Title'),
      points: [t('manual.c1p1'), t('manual.c1p2'), t('manual.c1p3')],
    },
    {
      title: t('manual.c2Title'),
      points: [t('manual.c2p1'), t('manual.c2p2'), t('manual.c2p3')],
    },
    {
      title: t('manual.c3Title'),
      points: [t('manual.c3p1'), t('manual.c3p2')],
    },
    {
      title: t('manual.c4Title'),
      points: [t('manual.c4p1'), t('manual.c4p2'), t('manual.c4p3')],
    },
  ]
  const admin: Section[] = [
    {
      title: t('manual.a1Title'),
      points: [t('manual.a1p1'), t('manual.a1p2')],
    },
    {
      title: t('manual.a2Title'),
      points: [t('manual.a2p1'), t('manual.a2p2'), t('manual.a2p3'), t('manual.a2p4')],
    },
    {
      title: t('manual.a3Title'),
      points: [t('manual.a3p1'), t('manual.a3p2'), t('manual.a3p3')],
    },
    {
      title: t('manual.capTitle'),
      points: [t('manual.cap1'), t('manual.cap2'), t('manual.cap3'), t('manual.cap4'), t('manual.cap5'), t('manual.cap6')],
    },
    {
      title: t('manual.a4Title'),
      points: [t('manual.a4p1'), t('manual.a4p2'), t('manual.a4p3')],
    },
    {
      title: t('manual.a5Title'),
      points: [t('manual.a5p1'), t('manual.a5p2'), t('manual.a5p3')],
    },
  ]
  const superadmin: Section[] = [
    {
      title: t('manual.su1Title'),
      points: [t('manual.su1p1'), t('manual.su1p2'), t('manual.su1p3'), t('manual.su1p4')],
    },
  ]
  const help: Section = {
    title: t('manual.helpTitle'),
    points: [t('manual.help1'), t('manual.help2'), t('manual.help3')],
  }
  const sections = scope === 'controle'
    ? [...shared, ...controleur]
    : [...shared, ...admin, ...(isSuper ? superadmin : [])]
  return { sections, help, isSuper }
}

export function ManualPage({ scope }: { scope: 'controle' | 'admin' }) {
  const { t } = useApp()
  const { sections, help } = useSections(scope)

  return (
    <>
      <PageHead
        title={t('manual.title')}
        subtitle={scope === 'controle' ? t('manual.subtitleControl') : t('manual.subtitleAdmin')}
        action={<button className="iz-btn iz-btn-outline iz-no-print" onClick={() => window.print()}>{t('manual.print')}</button>}      />
      <div className="iz-printable">
        <div className="iz-print-head">
          <img src="/brand/logo-commune.png" alt={t('footer.city')} />
          <div>
            <strong>{t('manual.printHeader')}</strong>
            <span>{scope === 'controle' ? t('manual.printControl') : t('manual.printAdmin')}</span>
            <span>{new Date().toLocaleDateString('fr-FR')}</span>
          </div>
        </div>

        <div className="iz-manual">
          {[...sections, help].map((section) => (
            <section className="iz-manual-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
