import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Electron 밖(브라우저 데모)에서는 배경을 깔아 확인하기 쉽게
if (!window.madi) document.body.classList.add("demo");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
