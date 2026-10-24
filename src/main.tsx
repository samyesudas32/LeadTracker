import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent unhandled promise rejection errors when users intentionally dismiss Firebase Auth popups
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const code = reason?.code || '';
    const msg = typeof reason === 'string' ? reason : reason?.message || '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      msg.includes('auth/popup-closed-by-user') ||
      msg.includes('auth/cancelled-popup-request')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
