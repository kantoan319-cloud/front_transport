import { Alert, Footer, Header, Toast, useApp } from './components'
import {
  CooperativesPage, HomePage, LoginPage, ParkingsPage,
  SearchPage, SignalPage, TrackPage,
} from './public'
import { NetworkMap } from './network-map'
import {
  ControlDashboard, ControlLayout, ControlSignalsPage, InfractionsPage,
  ScanPage, ScansPage,
} from './control'
import {
  AdminActivity, AdminCooperatives, AdminDashboard, AdminLayout,
  AdminOwners, AdminParkings, AdminPayments, AdminRequests,
  AdminStudies, AdminUsers, AdminVehicles,
} from './admin'
import { AdminLines } from './lines'

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="iz-card" style={{ maxWidth: 560, margin: '40px auto' }}>
      <Alert type="error">{message}</Alert>
    </div>
  )
}

export function IzApp() {
  const { route, t, user } = useApp()
  const path = route.split('?')[0]

  const render = () => {
    if (path === '/') return <HomePage />
    if (path === '/recherche') return <SearchPage />
    if (path === '/signaler') return <SignalPage />
    if (path === '/suivi') return <TrackPage />
    if (path === '/carte') return <NetworkMap />
    if (path === '/cooperatives') return <CooperativesPage />
    if (path === '/parkings') return <ParkingsPage />
    if (path === '/connexion') return <LoginPage />

    if (path.startsWith('/controle')) {
      if (!user) return <LoginPage />
      if (user.role !== 'admin' && user.role !== 'controleur') {
        return <AccessDenied message={t('common.error')} />
      }
      let content = <ControlDashboard />
      if (path === '/controle/scan') content = <ScanPage />
      else if (path === '/controle/scans') content = <ScansPage />
      else if (path === '/controle/infractions') content = <InfractionsPage />
      else if (path === '/controle/signals') content = <ControlSignalsPage />
      return <ControlLayout>{content}</ControlLayout>
    }

    if (path.startsWith('/admin')) {
      if (!user) return <LoginPage />
      if (user.role !== 'admin') return <AccessDenied message={t('common.error')} />
      let content = <AdminDashboard />
      if (path === '/admin/vehicles') content = <AdminVehicles />
      else if (path === '/admin/cooperatives') content = <AdminCooperatives />
      else if (path === '/admin/owners') content = <AdminOwners />
      else if (path === '/admin/lines') content = <AdminLines />
      else if (path === '/admin/studies') content = <AdminStudies />
      else if (path === '/admin/parkings') content = <AdminParkings />
      else if (path === '/admin/payments') content = <AdminPayments />
      else if (path === '/admin/requests') content = <AdminRequests />
      else if (path === '/admin/users') content = <AdminUsers />
      else if (path === '/admin/activity') content = <AdminActivity />
      return <AdminLayout>{content}</AdminLayout>
    }

    return <HomePage />
  }

  return (
    <div className="iz-app">
      <Header />
      <main className="iz-main"><div className="iz-container-wide">{render()}</div></main>
      <Footer />
      <Toast />
    </div>
  )
}
