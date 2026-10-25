import { Route, Switch } from 'wouter';
import { ActivityLayout } from '../../shell/ActivityLayout';
import { Dashboard } from './Dashboard';
import { OpsHome } from './OpsHome';

export function OpsRoutes() {
  return (
    <Switch>
      <Route path="/">
        <OpsHome />
      </Route>
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
