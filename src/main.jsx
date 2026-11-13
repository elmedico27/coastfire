import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted fonts, bundled at build time (latin subset, only the weights the app uses).
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/newsreader/latin-500.css';
import CoastFireMatrix from './CoastFireMatrix.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CoastFireMatrix />
  </React.StrictMode>
);
