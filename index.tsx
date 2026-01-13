
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// The Gemini SDK will find the API_KEY from process.env.API_KEY which is assumed to be pre-configured.

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
