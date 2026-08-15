import { Redirect, Route, Switch } from 'wouter';

import ActivityLayout from '@respond/components/activities/ActivityLayout';

import { ActivityEditPage } from './ActivityEditPage';
import { ActivityListPage } from './ActivityListPage';
import { ActivityPage } from './ActivityPage';

// Order matters: wouter's <Switch> renders the first matching <Route>, so more
// specific paths (e.g. /mission/new) must precede parameterized ones (/mission/:id).
export function RespondRoutes({ type }: { type: 'missions' | 'events' }) {
  return (
    <Switch>
      <Route path="/new">{() => <ActivityEditPage activityType={type} />}</Route>
      <Route path="/roster/:id">{(p) => <Redirect to={`~/reports/roster/${p.id}`} replace />}</Route>
      <Route path="/:id/edit">{(p) => <ActivityEditPage activityType={type} activityId={p.id} />}</Route>
      <Route path="/:id/ops">{(p) => <Redirect to={`~/ops/${p.id}`} replace />}</Route>
      <Route path="/:id">
        {(p) => (
          <ActivityLayout activityId={p.id}>
            <ActivityPage />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/">{() => <ActivityListPage activityType={type} />}</Route>
    </Switch>
  );
}
