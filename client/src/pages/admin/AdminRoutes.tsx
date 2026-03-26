import { useRoutes } from 'react-router';

import { ManageLocationsPage } from './ManageLocationsPage';

export default function AdminRoutes() {
  return useRoutes([
    { path: 'locations', element: <ManageLocationsPage /> },
  ]);
}
