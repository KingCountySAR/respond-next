import { Route, Switch } from 'wouter';
import { ActivityLayout } from '../../shell/ActivityLayout';
import { Dashboard } from './Dashboard';

export function OpsRoutes() {
  return (
    <Switch>
      <Route path="/:id">
        {(p) => (
          <ActivityLayout activityId={p.id}>
            <Dashboard />
          </ActivityLayout>
        )}
      </Route>
    </Switch>
  );
}
