import { Route, Switch } from 'wouter';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';

export function AdminRoutes() {
  return (
    <Switch>
      <Route path="/locations">
        <ToolbarPage>
          <Placeholder title="Locations" comesWith="the admin pages" />
        </ToolbarPage>
      </Route>
    </Switch>
  );
}
