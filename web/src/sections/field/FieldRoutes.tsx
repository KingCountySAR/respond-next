import { Redirect, Route, Switch } from 'wouter';
import { ActivityLayout } from '../../shell/ActivityLayout';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';
import { ActivityPage } from './ActivityPage';

// Mounted at /mission and /event. Order matters: specific paths before /:id.
export function FieldRoutes({ type }: { type: 'missions' | 'events' }) {
  return (
    <Switch>
      <Route path="/new">
        <ToolbarPage>
          <Placeholder title={type === 'missions' ? 'New Mission' : 'New Event'} comesWith="the field pages" />
        </ToolbarPage>
      </Route>
      <Route path="/roster/:id">{(p) => <Redirect to={`~/reports/roster/${p.id}`} replace />}</Route>
      <Route path="/:id/edit">
        {() => (
          <ToolbarPage>
            <Placeholder title="Edit" comesWith="the field pages" />
          </ToolbarPage>
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
