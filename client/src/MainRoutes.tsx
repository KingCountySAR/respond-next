import { Route, Routes } from 'react-router';

import AboutPage from './pages/AboutPage';
import { EventListPage } from './pages/EventListPage';
import { MemberLookupPage } from './pages/MemberLookupPage';

export const MainRoutes = () => (
  <Routes>
    <Route index element={<EventListPage />} />
    <Route path="/members" element={<MemberLookupPage />} />
    <Route path="/about" element={<AboutPage/>} />
  </Routes>
);
