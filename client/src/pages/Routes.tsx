import { lazy, PropsWithChildren, Suspense } from 'react';
import { Outlet } from 'react-router';

import AboutPage from './AboutPage';
const AdminRoutes = lazy(() => import('./admin/AdminRoutes'));
const RosterViewPage = lazy(() => import('./RosterViewPage'));
import { MemberLookupPage } from './MemberLookupPage';

const LoadingPage = ({ children }: PropsWithChildren<unknown>) => (
  <Suspense fallback={<div>Loading UI...</div>}>{children}</Suspense>
);

export default [
  { path: '/members', element: <MemberLookupPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/roster/:activityId', element: <LoadingPage><RosterViewPage /></LoadingPage> },
  {
    path: '/admin', element: (<LoadingPage><AdminRoutes/></LoadingPage>),
    children: [{ path: '*', element: <Outlet /> }],
  },
];
