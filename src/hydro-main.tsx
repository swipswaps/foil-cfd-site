import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HydroApp } from './sections/HydroLab';

const container = document.getElementById('hydro-root');
if (!container) {
  throw new Error('#hydro-root element missing from hydro.html');
}

createRoot(container).render(
  <StrictMode>
    <HydroApp />
  </StrictMode>,
);
