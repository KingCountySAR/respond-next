import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';

import AboutPage from './AboutPage';
const AdminRoutes = lazy(() => import('./admin/AdminRoutes'));
import { MemberLookupPage } from './MemberLookupPage';

export default [
  { path: '/members', element: <MemberLookupPage /> },
  { path: '/about', element: <AboutPage /> },
  {
    path: '/admin', element: (
      <Suspense fallback={<div>Loading ...</div>}>
        <AdminRoutes />
      </Suspense>
    ),
    children: [{ path: '*', element: <Outlet /> }],
  },
];
