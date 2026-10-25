import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { RespondRoutes, Home } from '../sections/respond';
import { ToolbarPage } from './ToolbarPage';

// Respond is what most people open, so it loads with the shell, as in the legacy app; the rest load
// when their route is first visited (ops ahead of that, once its toolbar button shows).
const OpsRoutes = lazy(() => import('../sections/ops').then((m) => ({ default: m.OpsRoutes })));
const ReportRoutes = lazy(() => import('../sections/reports').then((m) => ({ default: m.ReportRoutes })));
const AdminRoutes = lazy(() => import('../sections/admin').then((m) => ({ default: m.AdminRoutes })));

// Under the toolbar, so the page frame stays put while a section's code loads.
const loading = (
  <ToolbarPage>
    <div>Loading...</div>
  </ToolbarPage>
);

// The legacy app's URLs. Order matters: <Switch> renders the first match, so specific paths
// (/mission/new) come before parameterized ones (/mission/:id).
export function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/mission" nest>
        <RespondRoutes type="missions" />
      </Route>
      <Route path="/event" nest>
        <RespondRoutes type="events" />
      </Route>
      <Route path="/ops" nest>
        <Suspense fallback={loading}>
          <OpsRoutes />
        </Suspense>
      </Route>
      <Route path="/reports" nest>
        <Suspense fallback={loading}>
          <ReportRoutes />
        </Suspense>
      </Route>
      <Route path="/admin" nest>
        <Suspense fallback={loading}>
          <AdminRoutes />
        </Suspense>
      </Route>
    </Switch>
  );
}
