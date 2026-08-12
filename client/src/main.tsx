import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

import './globals.css';

// Allow bypassing StrictMode's double-invocation via ?disableStrict=1 (e.g. when debugging effects).
const strict = new URLSearchParams(window.location.search).get('disableStrict') !== '1';

createRoot(document.getElementById('root')!).render(strict ? (
  <StrictMode>
    <App />
  </StrictMode>
) : (
  <App />
));
