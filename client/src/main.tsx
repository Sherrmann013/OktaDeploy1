import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/use-theme";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="ui-theme">
    <App />
  </ThemeProvider>
);
