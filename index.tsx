
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Garante que o SDK do Gemini encontre as variáveis de ambiente
if (typeof window !== 'undefined') {
  (window as any).process = {
    env: {
      API_KEY: (import.meta as any).env?.VITE_API_KEY || ""
    }
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento root.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
