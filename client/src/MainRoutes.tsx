import { Route, Routes } from 'react-router';

import AboutPage from './pages/AboutPage';
import { EventListPage } from './pages/EventListPage';

export const MainRoutes = () => (
  <Routes>
    <Route index element={<EventListPage />} />
    <Route path="/about" element={<AboutPage/>} />
  </Routes>
);
