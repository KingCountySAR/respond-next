import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './shell/App';
import './globals.css';

// ?disableStrict=1 skips StrictMode's double-invocation, e.g. when debugging effects.
const strict = new URLSearchParams(window.location.search).get('disableStrict') !== '1';

createRoot(document.getElementById('root')!).render(
  strict ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  ),
);
