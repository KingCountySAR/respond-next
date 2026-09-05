import { Route, Switch } from 'wouter';

import { ActivityListPage } from '../respond/ActivityListPage';

import { RosterReportPage } from './RosterReportPage';

// Order matters: wouter's <Switch> renders the first matching <Route>, so more
// specific paths (e.g. /mission/new) must precede parameterized ones (/mission/:id).
export function ReportRoutes() {
  return (
    <Switch>
      <Route path="/roster/:id">{(p) => <RosterReportPage activityId={p.id} />}</Route>
      <Route path="/missions">
        <ActivityListPage activityType="missions" />
      </Route>
      <Route path="/events">
        <ActivityListPage activityType="events" />
      </Route>
    </Switch>
  );
}
