import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider, useSession } from '@/domains/session/SessionProvider'
import { STAFF } from '@/data/roles'
import { ChangePasswordPage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyPage, WelcomePage } from '@/domains/session/AuthPages'
import { isMock } from '@/data/api'
import { HomePage } from '@/domains/home/HomePage'
import { PrimaryWizard } from '@/domains/applications/PrimaryWizard'
import { ApplicationTracker } from '@/domains/applications/ApplicationTracker'
import { MonitoringIntro } from '@/domains/mortgages/MonitoringPages'
import { MortgageSetupWizard } from '@/domains/mortgages/MortgageSetupWizard'
import { MyKprLayout, MyKprResolver } from '@/domains/mortgages/MyKprLayout'
import { OverviewTab, PaymentTab, PropertyTab, RateTab } from '@/domains/mortgages/MyKprTabs'
import { AmortizationPage, AmortizationSchedulePage } from '@/domains/mortgages/AmortizationPages'
import { HealthPage } from '@/domains/mortgages/HealthPage'
import { ExplorePage, EducationPage } from '@/domains/explore/ExplorePages'
import { OptimizeIntro } from '@/domains/optimize/OptimizeIntro'
import { OptimizeStepPage } from '@/domains/optimize/OptimizeSteps'
import { GoalStartPage } from '@/domains/optimize/GoalStartPage'
import { BaselinePage, ProgramsPage, ProgramDetailPage, ConfirmProgramPage } from '@/domains/optimize/ProgramPages'
import { ActivityPage } from '@/domains/activity/ActivityPage'
import { ProfilePage, ProfileEditPage, ReminderSettingsPage } from '@/domains/profile/ProfilePages'
import { AdminLayout, ForbiddenPage } from '@/domains/admin/AdminLayout'
import { OverviewPage as AdminOverviewPage } from '@/domains/admin/OverviewPage'
import { UserDetailPage, UserHistoryPage, UserListPage, UserMortgagePage } from '@/domains/admin/UsersPages'
import { ApplicationDetailPage, ApplicationListPage } from '@/domains/admin/ApplicationsPages'
import { CoverLetterPage } from '@/domains/admin/CoverLetterPage'
import { BankListPage, ProductFormPage, ProductListPage } from '@/domains/admin/CatalogPages'
import { ArticleFormPage, ArticleListPage } from '@/domains/admin/ArticlesPages'
import { ReportsPage } from '@/domains/admin/ReportsPage'
import { ConfigurationPage, HealthConfigPage } from '@/domains/admin/ConfigurationPage'
import { SchedulePage } from '@/domains/admin/SchedulePage'
import { AuditLogPage } from '@/domains/admin/AuditLogPage'
import { BrandPage, BrandPreviewBar } from '@/domains/admin/BrandPage'
import { useLiveBrand } from '@/brand/live'
import { NotFoundPage } from './NotFoundPage'
import { DevPanel } from './DevPanel'

// Where each session status belongs; a guard sends any session it does not serve to its home. `pending` waits for the
// code that verifies a new account; `recovery` came in through a reset link and still has to set its new password.
const HOME_OF = { guest: '/login', pending: '/verify', recovery: '/reset-password', onboarding: '/welcome', authenticated: '/' }
// Anyone not signed in, or halfway through a code, may go back to these.
const SIGNED_OUT = ['guest', 'pending', 'recovery']

// B2C pages send staff to their admin home (roles.js), except while they preview a brand draft on the whole site;
// /admin answers everyone else with a 403, never a silent redirect. UX only: every admin operation checks the role
// again in the data layer.
function RequireAuth({ admin = false }) {
  const { session } = useSession()
  const { preview } = useLiveBrand()
  if (session.status !== 'authenticated') return <Navigate to={HOME_OF[session.status]} replace />
  const home = STAFF[session.role]?.home
  if (admin && !home) return <ForbiddenPage />
  if (!admin && home && !preview) return <Navigate to={home} replace />
  return <Outlet />
}

function SessionGate({ allow }) {
  const { session } = useSession()
  return allow.includes(session.status) ? <Outlet /> : <Navigate to={HOME_OF[session.status]} replace />
}

const router = createBrowserRouter([
  {
    element: <SessionGate allow={SIGNED_OUT} />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  { element: <SessionGate allow={['pending']} />, children: [{ path: '/verify', element: <VerifyPage /> }] },
  // A guest here followed a reset link that failed; the page says so.
  { element: <SessionGate allow={['guest', 'recovery']} />, children: [{ path: '/reset-password', element: <ResetPasswordPage /> }] },
  { element: <SessionGate allow={['onboarding']} />, children: [{ path: '/welcome', element: <WelcomePage /> }] },
  {
    path: '/admin',
    element: <RequireAuth admin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminOverviewPage /> },
          { path: 'users', element: <UserListPage /> },
          { path: 'users/:userId', element: <UserDetailPage /> },
          { path: 'users/:userId/kpr/:mortgageId', element: <UserMortgagePage /> },
          { path: 'users/:userId/riwayat', element: <UserHistoryPage /> },
          { path: 'applications', element: <ApplicationListPage /> },
          { path: 'applications/:applicationId', element: <ApplicationDetailPage /> },
          { path: 'applications/:applicationId/surat-pengantar', element: <CoverLetterPage /> },
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'products', element: <ProductListPage /> },
          { path: 'products/new', element: <ProductFormPage /> },
          { path: 'products/:productId', element: <ProductFormPage /> },
          { path: 'banks', element: <BankListPage /> },
          { path: 'articles', element: <ArticleListPage /> },
          { path: 'articles/new', element: <ArticleFormPage /> },
          { path: 'articles/:articleId', element: <ArticleFormPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'configuration', element: <ConfigurationPage /> },
          { path: 'brand', element: <BrandPage /> },
          { path: 'configuration/health', element: <HealthConfigPage /> },
          { path: 'audit-log', element: <AuditLogPage /> },
          { path: 'password', element: <ChangePasswordPage admin /> },
          { path: '*', element: <NotFoundPage to="/admin" label="Kembali ke Overview" /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'home', element: <Navigate to="/" replace /> },
          { path: 'apply/primary/:step/:productId?', element: <PrimaryWizard /> },
          { path: 'monitoring/intro', element: <MonitoringIntro /> },
          { path: 'monitoring/setup/:step', element: <MortgageSetupWizard /> },
          { path: 'optimize/intro', element: <OptimizeIntro /> },
          { path: 'optimize/start', element: <GoalStartPage /> },
          { path: 'optimize/1/pekerjaan', element: <OptimizeStepPage employment /> },
          { path: 'optimize/baseline', element: <BaselinePage /> },
          { path: 'optimize/programs', element: <ProgramsPage /> },
          { path: 'optimize/programs/:productId', element: <ProgramDetailPage /> },
          { path: 'optimize/programs/:productId/confirm', element: <ConfirmProgramPage /> },
          { path: 'optimize/:step', element: <OptimizeStepPage /> },
          { path: 'my-kpr', element: <MyKprResolver /> },
          { path: 'my-kpr/application', element: <ApplicationTracker /> },
          {
            path: 'my-kpr',
            element: <MyKprLayout />,
            children: [
              { path: 'overview', element: <OverviewTab /> },
              { path: 'payment', element: <PaymentTab /> },
              { path: 'rate', element: <RateTab /> },
              { path: 'property', element: <PropertyTab /> },
            ],
          },
          { path: 'my-kpr/amortization', element: <AmortizationPage /> },
          { path: 'my-kpr/amortization/jadwal', element: <AmortizationSchedulePage /> },
          { path: 'my-kpr/health', element: <HealthPage /> },
          { path: 'explore', element: <ExplorePage /> },
          { path: 'education/:slug', element: <EducationPage /> },
          { path: 'activity', element: <ActivityPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'profile/edit', element: <ProfileEditPage /> },
          { path: 'profile/reminders', element: <ReminderSettingsPage /> },
          { path: 'profile/password', element: <ChangePasswordPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-center"
        offset={88}
        toastOptions={{ style: { background: 'var(--inverse)', color: 'var(--inverse-foreground)', border: 'none', borderRadius: 14, fontFamily: 'inherit', fontWeight: 600, fontSize: 14 } }}
      />
      <BrandPreviewBar onBack={() => router.navigate('/admin/brand')} />
      {import.meta.env.DEV && isMock && <DevPanel />}
    </SessionProvider>
  )
}
