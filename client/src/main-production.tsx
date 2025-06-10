// Production entry point that works with global React
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

// Use global React from CDN
const React = (window as any).React;
const ReactDOM = (window as any).ReactDOM;

// Initialize the app when DOM is ready
function initApp() {
  const root = document.getElementById("root");
  if (root && ReactDOM) {
    ReactDOM.render(
      React.createElement(ThemeProvider, { defaultTheme: "dark", storageKey: "ui-theme" },
        React.createElement(App)
      ),
      root
    );
  }
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}