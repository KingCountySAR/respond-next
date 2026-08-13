import { Route, Switch } from 'wouter';

import ActivityLayout from '@respond/components/activities/ActivityLayout';
import { RosterReview } from '@respond/components/activities/RosterView';
import { OperationsDashboard } from '@respond/components/dashboard/OperationsDashboard';
import { LocationManager } from '@respond/components/locations/LocationManager';

import { Home } from './pages/Home';
import { ActivityEditPage } from './pages/respond/ActivityEditPage';
import { ActivityListPage } from './pages/respond/ActivityListPage';
import { ActivityPage } from './pages/respond/ActivityPage';

// Order matters: wouter's <Switch> renders the first matching <Route>, so more
// specific paths (e.g. /mission/new) must precede parameterized ones (/mission/:id).
export function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      <Route path="/mission/new">{() => <ActivityEditPage activityType="missions" />}</Route>
      <Route path="/mission/:missionId/edit">{(p) => <ActivityEditPage activityType="missions" activityId={p.missionId} />}</Route>
      <Route path="/mission/:missionId/ops">
        {(p) => (
          <ActivityLayout activityId={p.missionId}>
            <OperationsDashboard />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/mission/:missionId">
        {(p) => (
          <ActivityLayout activityId={p.missionId}>
            <ActivityPage />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/mission">{() => <ActivityListPage activityType="missions" />}</Route>

      <Route path="/event/new">{() => <ActivityEditPage activityType="events" />}</Route>
      <Route path="/event/:eventId/edit">{(p) => <ActivityEditPage activityType="events" activityId={p.eventId} />}</Route>
      <Route path="/event/:eventId/ops">
        {(p) => (
          <ActivityLayout activityId={p.eventId}>
            <OperationsDashboard />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/event/:eventId">
        {(p) => (
          <ActivityLayout activityId={p.eventId}>
            <ActivityPage />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/event">{() => <ActivityListPage activityType="events" />}</Route>

      <Route path="/roster/:activityId">{(p) => <RosterReview activityId={p.activityId} />}</Route>
      <Route path="/admin/locations" component={LocationManager} />
    </Switch>
  );
}
