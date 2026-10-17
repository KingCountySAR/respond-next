import { Route, Switch } from 'wouter';
import { ActivityListPage } from './ActivityListPage';
import { RosterReportPage } from './RosterReportPage';

export function ReportRoutes() {
  return (
    <Switch>
      <Route path="/roster/:id">
        {(p) => <RosterReportPage activityId={p.id} />}
      </Route>
      <Route path="/missions">
        <ActivityListPage activityType="missions" />
      </Route>
      <Route path="/events">
        <ActivityListPage activityType="events" />
      </Route>
    </Switch>
  );
}
