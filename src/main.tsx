import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import App from './App';
import './styles.css';
import './queue.css';
import './integration.css';
import './panel-theme.css';

const root = document.getElementById('root')!;
ReactDOM.createRoot(root, {
  onUncaughtError(error) {
    root.textContent = `PeatForge tidak dapat dimuat: ${error instanceof Error ? error.message : String(error)}`;
    root.setAttribute('role', 'alert');
  },
}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
