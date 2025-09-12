import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { HashRouter } from 'react-router-dom'

// Electron 환경에서 콘솔 로그를 메인 프로세스로 전달하는 함수
function sendToMainProcess(level, ...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  if (window.electronAPI) {
    try {
      window.electronAPI.sendConsoleLog(level, message);
    } catch (error) {
      // IPC 전송 실패 시 무시
    }
  }
}

// console 메서드들을 오버라이드
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
};

console.log = (...args) => {
  originalConsole.log(...args);
  sendToMainProcess('log', ...args);
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  sendToMainProcess('warn', ...args);
};

console.error = (...args) => {
  originalConsole.error(...args);
  sendToMainProcess('error', ...args);
};

console.info = (...args) => {
  originalConsole.info(...args);
  sendToMainProcess('info', ...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)

