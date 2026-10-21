import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { brand } from './brand/brand';
import { applyTheme } from './brand/applyTheme';
import { BrandProvider } from './brand/BrandProvider';
import './styles/index.css';

applyTheme(brand);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandProvider>
      <App />
    </BrandProvider>
  </StrictMode>,
);
