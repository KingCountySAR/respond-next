import { Redirect, Route, Switch } from 'wouter';
import { ActivityLayout } from '../../shell/ActivityLayout';
import { ActivityEditPage, ActivityNewPage } from './ActivityEditPage';
import { ActivityPage } from './ActivityPage';

// Mounted at /mission and /event. Order matters: specific paths before /:id.
export function FieldRoutes({ type }: { type: 'missions' | 'events' }) {
  return (
    <Switch>
      <Route path="/new">
        <ActivityNewPage activityType={type} />
      </Route>
      <Route path="/roster/:id">{(p) => <Redirect to={`~/reports/roster/${p.id}`} replace />}</Route>
      <Route path="/:id/edit">
        {(p) => (
          <ActivityLayout activityId={p.id}>
            <ActivityEditPage activityType={type} />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/:id/ops">{(p) => <Redirect to={`~/ops/${p.id}`} replace />}</Route>
      <Route path="/:id">
        {(p) => (
          <ActivityLayout activityId={p.id}>
            <ActivityPage />
          </ActivityLayout>
        )}
      </Route>
      <Route path="/">
        <Redirect to={`~/reports/${type}`} replace />
      </Route>
    </Switch>
  );
}
