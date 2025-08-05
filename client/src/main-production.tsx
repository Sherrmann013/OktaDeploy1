// Production entry point that works with global React
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

// Initialize the app when DOM is ready
function initApp() {
  const rootElement = document.getElementById("root");
  
  if (rootElement) {
    rootElement.innerHTML = "";
    
    try {
      const root = createRoot(rootElement);
      root.render(
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
          <App />
        </ThemeProvider>
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      rootElement.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">
        <h3>React Rendering Error:</h3>
        <p><strong>Message:</strong> ${errorMessage}</p>
        <p><strong>Type:</strong> ${error?.constructor?.name || 'Unknown'}</p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error?.stack || 'No stack trace'}</pre>
      </div>`;
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}