import { Route, Switch } from 'wouter';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';
import { ActivityListPage } from './ActivityListPage';

export function ReportRoutes() {
  return (
    <Switch>
      <Route path="/roster/:id">
        {() => (
          <ToolbarPage>
            <Placeholder title="Roster" comesWith="the reports" />
          </ToolbarPage>
        )}
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
