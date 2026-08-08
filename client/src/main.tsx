import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fuentes autoalojadas: el CSP del servidor solo permite fontSrc 'self'.
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontro el contenedor #root.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
