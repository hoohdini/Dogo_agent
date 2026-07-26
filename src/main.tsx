import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Electron 밖(브라우저 데모)에서는 배경을 깔아 확인하기 쉽게
if (!window.madi) document.body.classList.add("demo");

// StrictMode 미사용: dev에서 effect를 두 번 실행해
// "물고 온 텍스트 자동 전송"이 시작되자마자 중단되는 문제가 있다.
createRoot(document.getElementById("root")!).render(<App />);
