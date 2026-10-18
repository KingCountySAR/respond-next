import { Route, Switch } from 'wouter';
import { LocationManager } from './LocationManager';

export function AdminRoutes() {
  return (
    <Switch>
      <Route path="/locations" component={LocationManager} />
    </Switch>
  );
}
