import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./theme.css";
import { applyTheme, getInitialTheme } from "./theme";

applyTheme(getInitialTheme(), { emit: false });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
