import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

// Clear any cached theme to ensure dark mode applies
localStorage.removeItem("ui-theme");

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
    <App />
  </ThemeProvider>
);
