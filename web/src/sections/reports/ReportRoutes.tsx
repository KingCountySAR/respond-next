import { Route, Switch } from 'wouter';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';

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
        <ToolbarPage>
          <Placeholder title="Missions" comesWith="activity summaries on the server" />
        </ToolbarPage>
      </Route>
      <Route path="/events">
        <ToolbarPage>
          <Placeholder title="Events" comesWith="activity summaries on the server" />
        </ToolbarPage>
      </Route>
    </Switch>
  );
}
