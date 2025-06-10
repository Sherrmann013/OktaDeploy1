// Production entry point that works with global React
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

// Initialize the app when DOM is ready
function initApp() {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    // Clear loading text
    rootElement.innerHTML = "";
    
    // Create React root and render app
    const root = createRoot(rootElement);
    root.render(
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        <App />
      </ThemeProvider>
    );
  }
}

// Start the app immediately
initApp();