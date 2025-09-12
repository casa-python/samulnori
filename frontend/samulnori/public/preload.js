// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// contextBridge를 통해 렌더러 프로세스에 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  oauthLogin: (provider) => ipcRenderer.invoke('oauth-login', provider),
  onOAuthCallback: (callback) => {
    ipcRenderer.on('oauth-callback', (event, data) => callback(data));
  },
  onOAuthClosed: (callback) => {
    ipcRenderer.on('oauth-closed', () => callback());
  },
  // 앱 종료 시 클리어 함수 추가
  onAppExit: (callback) => {
    ipcRenderer.on('app-exit', () => callback());
  },
  // 메인 프로세스에 콘솔 로그 전송
  sendConsoleLog: (level, message) => {
    try {
      ipcRenderer.send('console-log', { level, message });
    } catch (_) {}
  },
  // 비디오 저장 (WebM -> MP4 변환 포함, 메인 프로세스에서 처리)
  saveVideo: (arrayBuffer, suggestedName) => {
    console.log('[renderer] invoke save-video', { size: arrayBuffer?.byteLength, suggestedName });
    return ipcRenderer.invoke('save-video', { arrayBuffer, suggestedName });
  },
  // 기본 samples 폴더 로드
  loadDefaultSamples: async () => {
    try {
      const result = await ipcRenderer.invoke('load-default-samples');
      return result; // { folderPath, tree }
    } catch (e) {
      return null;
    }
  },
  // 샘플 폴더 선택 (디렉터리 선택 다이얼로그)
  selectSampleFolder: async () => {
    try {
      const result = await ipcRenderer.invoke('select-sample-folder');
      return result; // { folderPath, tree }
    } catch (e) {
      return null;
    }
  },
  readAudioAsDataUrl: async (filePath) => {
    try {
      return await ipcRenderer.invoke('read-audio-as-data-url', filePath);
    } catch {
      return null;
    }
  },
  readFileAsDataUrl: async (filePath) => {
    try {
      return await ipcRenderer.invoke('read-file-as-data-url', filePath);
    } catch {
      return null;
    }
  }
});

// WebSocket 프록시 API (Main에서 백엔드 WS 유지)
contextBridge.exposeInMainWorld('ws', {
  onStatus: (cb) => ipcRenderer.on('ws:status', (_e, s) => cb(s)),
  onMessage: (cb) => ipcRenderer.on('ws:message', (_e, msg) => cb(msg)),
  offAll: () => {
    ipcRenderer.removeAllListeners('ws:status');
    ipcRenderer.removeAllListeners('ws:message');
  },
  send: (payload) => ipcRenderer.send('ws:send', payload),
  reconnect: () => ipcRenderer.send('ws:reconnect'),
  disconnect: () => ipcRenderer.send('ws:disconnect')
});

// 강제 종료 시 스토어 클리어를 위한 전역 함수 노출
contextBridge.exposeInMainWorld('clearAllStores', () => {
  try {
    // localStorage 클리어
    localStorage.clear();
    sessionStorage.clear();
    
    // Zustand 스토어들 클리어
    if (window.useAuthStore && window.useAuthStore.getState) {
      window.useAuthStore.getState().clearUser();
    }
    if (window.useCameraStore && window.useCameraStore.getState) {
      window.useCameraStore.getState().reset();
    }
    if (window.useObjectSelectionStore && window.useObjectSelectionStore.getState) {
      window.useObjectSelectionStore.getState().reset();
    }
    
    console.log('모든 스토어 클리어 완료');
  } catch (e) {
    console.error('스토어 클리어 실패:', e);
  }
});

// 콘솔 로그를 메인 프로세스로 전달하는 함수
function sendConsoleLog(level, ...args) {
  const message = args.map(arg => {
    try {
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    } catch (e) {
      return '[Unserializable Object]';
    }
  }).join(' ');
  
  try {
    ipcRenderer.send('console-log', { level, message });
  } catch (error) {
    // IPC 전송 실패 시 무시
  }
}

// 원본 console 메서드들을 저장
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
};

// console 메서드들을 오버라이드
function overrideConsole() {
  console.log = (...args) => {
    originalConsole.log(...args);
    sendConsoleLog('log', ...args);
  };

  console.warn = (...args) => {
    originalConsole.warn(...args);
    sendConsoleLog('warn', ...args);
  };

  console.error = (...args) => {
    originalConsole.error(...args);
    sendConsoleLog('error', ...args);
  };

  console.info = (...args) => {
    originalConsole.info(...args);
    sendConsoleLog('info', ...args);
  };

  // window 객체에도 console 오버라이드를 적용 <-- 왜??
  window.console = console;
}

// 즉시 console 오버라이드 적용
overrideConsole();

// 전역 객체에 콘솔 오버라이드 함수 노출
window.__overrideConsole = overrideConsole;

// DOM 로드 완료 후에도 콘솔 오버라이드 유지
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
});