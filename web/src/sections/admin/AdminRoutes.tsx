import { Route, Switch } from 'wouter';
import { LocationManager } from './LocationManager';
import { OrganizationAdmin } from './OrganizationAdmin';

export function AdminRoutes() {
  return (
    <Switch>
      <Route path="/locations" component={LocationManager} />
      <Route path="/organizations" component={OrganizationAdmin} />
    </Switch>
  );
}
