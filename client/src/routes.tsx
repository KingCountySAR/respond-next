import { Redirect, Route, Switch } from 'wouter';

import { LocationManager } from '@respond/components/locations/LocationManager';

import { Home } from './pages/Home';
import { OpsRoutes } from './pages/operations/OpsRoutes';
import { ReportRoutes } from './pages/reports/ReportRoutes';
import { RespondRoutes } from './pages/respond/RespondRoutes';

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
        <OpsRoutes />
      </Route>
      <Route path="/reports" nest>
        <ReportRoutes />
      </Route>

      <Route path="/admin/locations" component={LocationManager} />
    </Switch>
  );
}
