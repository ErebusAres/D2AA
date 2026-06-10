import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';

import './styles/global.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/panels.css';
import './styles/armor-card.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
