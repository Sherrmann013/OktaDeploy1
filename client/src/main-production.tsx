// Production entry point that works with global React
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

// Initialize the app when DOM is ready
function initApp() {
  console.log('🚀 initApp() called');
  console.log('📋 Document ready state:', document.readyState);
  
  const rootElement = document.getElementById("root");
  console.log('🎯 Root element found:', !!rootElement);
  
  if (rootElement) {
    console.log('🧹 Clearing root element...');
    rootElement.innerHTML = "";
    
    try {
      console.log('⚛️ Creating React root...');
      const root = createRoot(rootElement);
      
      console.log('🎨 Rendering app...');
      root.render(
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
          <App />
        </ThemeProvider>
      );
      console.log('✅ React app rendered successfully');
    } catch (error) {
      console.error('❌ Error rendering React app:', error);
      rootElement.innerHTML = `<div style="color: red; padding: 20px;">Error: ${error.message}</div>`;
    }
  } else {
    console.error('❌ Root element not found');
  }
}

// Add debugging for script loading
console.log('🔧 Script loaded, document state:', document.readyState);

if (document.readyState === 'loading') {
  console.log('⏳ Waiting for DOM to load...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, calling initApp');
    initApp();
  });
} else {
  console.log('📄 DOM already loaded, calling initApp immediately');
  initApp();
}