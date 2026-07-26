
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Root element acquisition with safety check
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to. Ensure <div id='root'></div> exists in index.html.");
}

// Create React 19 root and render the App component
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
