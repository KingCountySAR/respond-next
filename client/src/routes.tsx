import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';

import { LocationManager } from '@respond/components/locations/LocationManager';

import { Home } from './pages/respond/Home';
import { RespondRoutes } from './pages/respond/RespondRoutes';

const OpsRoutes = lazy(() => import('./pages/operations/OpsRoutes').then((m) => ({ default: m.OpsRoutes })));
const ReportRoutes = lazy(() => import('./pages/reports/ReportRoutes').then((m) => ({ default: m.ReportRoutes })));

// Order matters: wouter's <Switch> renders the first matching <Route>, so more
// specific paths (e.g. /mission/new) must precede parameterized ones (/mission/:id).
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
        <Suspense fallback={<div>Loading...</div>}>
          <OpsRoutes />
        </Suspense>
      </Route>
      <Route path="/reports" nest>
        <Suspense fallback={<div>Loading...</div>}>
          <ReportRoutes />
        </Suspense>
      </Route>

      <Route path="/admin/locations" component={LocationManager} />
    </Switch>
  );
}
