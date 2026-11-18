import React from 'react';
import ReactDOM from 'react-dom/client';
import { HydroApp } from './sections/HydroLab';

ReactDOM.createRoot(document.getElementById('hydro-root')!).render(
  <React.StrictMode>
    <HydroApp />
  </React.StrictMode>
);
