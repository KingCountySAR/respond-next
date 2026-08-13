import { Route, Switch } from 'wouter';

import { RosterReportPage } from './RosterReportPage';

// Order matters: wouter's <Switch> renders the first matching <Route>, so more
// specific paths (e.g. /mission/new) must precede parameterized ones (/mission/:id).
export function ReportRoutes() {
  return (
    <Switch>
      <Route path="/roster/:id">{(p) => <RosterReportPage activityId={p.id} />}</Route>
    </Switch>
  );
}
