import { Alert, Footer, Header, Loading, Toast, useApp } from './components'
import { BusPage, ImpoundsPage, PublicScanPage } from './bus'
import {
  CooperativesPage, HomePage, LoginPage, SearchPage,
  SignalPage, TrackPage,
} from './public'
import { NetworkMap } from './network-map'
import {
  ControlDashboard, ControlLayout, ControlSignalsPage, InfractionsPage,
  ScanPage, ScansPage,
} from './control'
import {
  AdminActivity, AdminAnalytics, AdminCooperatives, AdminDashboard, AdminLayout, AdminLicences,
  AdminOwners, AdminPayments, AdminPaymentsRegister, AdminRequests,
  AdminUsers, AdminVehicles,
} from './admin'
import { AdminAttestations } from './attestations'
import { AdminLines } from './lines'
import { ManualPage } from './manual'
import { AdminControllerProfiles, ControllerProfilePage } from './profiles'

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="iz-card" style={{ maxWidth: 560, margin: '40px auto' }}>
      <Alert type="error">{message}</Alert>
    </div>
  )
}

export function IzApp() {
  const { route, t, user, userLoading } = useApp()
  const path = route.split('?')[0]

  const render = () => {
    if (path === '/') return <HomePage />
    if (path === '/scan') return <PublicScanPage />
    if (path === '/recherche') return <SearchPage />
    if (path === '/bus') {
      if (userLoading) return <Loading />
      const plate = new URLSearchParams(route.split('?')[1]).get('plaque') ?? ''
      return plate ? <BusPage key={`${plate}-${user?.id ?? 'public'}-${user?.role}`} plate={plate} /> : <PublicScanPage />
    }
    if (path === '/signaler') return <SignalPage key={route} />
    if (path === '/suivi') {
      if (userLoading) return <Loading />
      return user
        ? <TrackPage />
        : <AccessDenied message="Le suivi des signalements est réservé aux agents habilités. Connectez-vous avec votre compte." />
    }
    if (path === '/carte') return <NetworkMap />
    if (path === '/cooperatives') {
      if (userLoading) return <Loading />
      return user
        ? <CooperativesPage />
        : <AccessDenied message="Les coopératives sont réservées aux agents habilités. Connectez-vous avec votre compte." />
    }
    if (path === '/connexion') return <LoginPage />

    if (path.startsWith('/controle')) {
      if (userLoading) return <Loading />
      if (!user) return <LoginPage />
      if (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'controleur') {
        return <AccessDenied message={t('common.error')} />
      }
      let content = <ControlDashboard />
      if (path === '/controle/scan') content = <ScanPage key={route} />
      else if (path === '/controle/fourriere') content = <ImpoundsPage />
      else if (path === '/controle/scans') content = <ScansPage />
      else if (path === '/controle/infractions') content = <InfractionsPage />
      else if (path === '/controle/signals') content = <ControlSignalsPage />
      else if (path === '/controle/profil') content = <ControllerProfilePage />
      else if (path === '/controle/manuel') content = <ManualPage scope="controle" />
      // Un administrateur garde son menu d'administration sur les pages de terrain.
      return user.role === 'admin' || user.role === 'superadmin'
        ? <AdminLayout>{content}</AdminLayout>
        : <ControlLayout>{content}</ControlLayout>
    }

    if (path.startsWith('/admin')) {
      if (userLoading) return <Loading />
      if (!user) return <LoginPage />
      if (user.role !== 'admin' && user.role !== 'superadmin') return <AccessDenied message={t('common.error')} />
      let content = <AdminDashboard />
      if (path === '/admin/vehicles') content = <AdminVehicles />
      else if (path === '/admin/analytics') content = <AdminAnalytics />
      else if (path === '/admin/cooperatives') content = <AdminCooperatives />
      else if (path === '/admin/owners') content = <AdminOwners />
      else if (path === '/admin/lines') content = <AdminLines />
      else if (path === '/admin/attestations') content = <AdminAttestations />
      else if (path === '/admin/licenses') content = <AdminLicences />
      else if (path === '/admin/payments') content = <AdminPayments />
      else if (path === '/admin/payments/register') content = <AdminPaymentsRegister />
      else if (path === '/admin/requests') content = <AdminRequests />
      else if (path === '/admin/users') content = <AdminUsers />
      else if (path === '/admin/profiles') content = <AdminControllerProfiles />
      else if (path === '/admin/activity') content = <AdminActivity />
      else if (path === '/admin/manuel') content = <ManualPage scope="admin" />
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
