import { Route, Switch } from 'wouter';

import ActivityLayout from '@respond/components/activities/ActivityLayout';

import { Dashboard } from './components/Dashboard';

// Order matters: wouter's <Switch> renders the first matching <Route>, so more
// specific paths (e.g. /mission/new) must precede parameterized ones (/mission/:id).
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
