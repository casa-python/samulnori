const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { globalShortcut } = require('electron');
const fs = require('fs');
const { execFile } = require('child_process');
const WebSocket = require('ws');
let ffmpegStatic = null;

try {
  ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    console.log('[save-video] Using bundled ffmpeg-static at', ffmpegStatic);
  }
} catch (_) {
  // optional
}

// ✅ 실행 가능한 경로 반환 함수 (asar-unpacked 보정)
function getFfmpegPath() {
  if (!ffmpegStatic) return null;
  return ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
}

let mainWindow;
let fastapiProcess;
let isShuttingDown = false;

// WebSocket (Backend) 관리 상태
let backendWs = null;
let wsReconnectTimer = null;
let wsRetryCount = 0;
const BACKEND_WS_URL = 'ws://localhost:8000/ws';

function broadcastToRenderers(channel, payload) {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send(channel, payload);
        } catch (_) {}
      }
    });
  } catch (_) {}
}

function connectBackendWebSocket() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (backendWs) {
    try { backendWs.terminate(); } catch (_) {}
    backendWs = null;
  }

  try {
    backendWs = new WebSocket(BACKEND_WS_URL);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  backendWs.on('open', () => {
    wsRetryCount = 0;
    broadcastToRenderers('ws:status', { connected: true, retryCount: wsRetryCount });
  });

  backendWs.on('close', () => {
    broadcastToRenderers('ws:status', { connected: false, retryCount: wsRetryCount });
    scheduleReconnect();
  });

  backendWs.on('error', () => {
    broadcastToRenderers('ws:status', { connected: false, retryCount: wsRetryCount, error: 'WS_ERROR' });
  });

  backendWs.on('message', (data, isBinary) => {
    try {
      if (isBinary) {
        // JPEG 등 바이너리 프레임 → ArrayBuffer로 전달
        if (Buffer.isBuffer(data)) {
          const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          broadcastToRenderers('ws:message', ab);
        } else {
          broadcastToRenderers('ws:message', data);
        }
        return;
      }
      // 텍스트 프레임(JSON 등) → 문자열로 전달
      if (typeof data === 'string') {
        broadcastToRenderers('ws:message', data);
      } else if (Buffer.isBuffer(data)) {
        broadcastToRenderers('ws:message', data.toString('utf8'));
      } else {
        broadcastToRenderers('ws:message', String(data));
      }
    } catch (_) {}
  });
}

function scheduleReconnect() {
  wsRetryCount += 1;
  const base = 1500;
  const delay = Math.min(base * Math.pow(2, Math.max(0, wsRetryCount - 1)), 30000);
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(connectBackendWebSocket, delay);
  broadcastToRenderers('ws:status', { connected: false, retryCount: wsRetryCount });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // TODO : webPreferences 설정 추후 변경 필요
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      // 보안 설정 개선
      allowRunningInsecureContent: false, // 안전하지 않은 컨텐츠 실행 비활성화
      devTools: true,
      openDevTools: false, //process.env.NODE_ENV === 'development',
      devTools: true, //process.env.NODE_ENV === 'development',
      enableRemoteModule: false,
      experimentalFeatures: false, // 실험적 기능 비활성화
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      // community 관련 설정
      javascript: true,
      webviewTag: false, // 보안을 위해 webview 비활성화
      nativeWindowOpen: true,
      nodeIntegrationInSubFrames: false,
    },
  });

  // 창을 최대화
  mainWindow.maximize();

  // 개발자 도구 자동 열기 (주석 처리)
  // mainWindow.webContents.openDevTools();
  // 페이지 로드 완료 이벤트
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Electron: 페이지 로드 완료");
  });

  // 페이지 로드 실패 이벤트
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("Electron: 페이지 로드 실패:", errorCode, errorDescription, validatedURL);
  });

  // 창이 닫힐 때 이벤트
  mainWindow.on("close", (event) => {
    if (!isShuttingDown) {
      event.preventDefault();
      console.log("Electron: 창 닫기 요청 - 정리 작업 시작");
      app.quit();
    }
  });

  // CSP 헤더 강화
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self';",
          "script-src 'self' 'unsafe-inline';",
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data: blob: https: http: file:;",
          "media-src 'self' data: blob: https: http: file:;",
          "connect-src 'self' https://i13a108.p.ssafy.io http://localhost:8000 ws://localhost:8000 data: blob:;",
          "frame-src 'self' https://accounts.google.com https://nid.naver.com https://kauth.kakao.com;",
          "worker-src 'self' blob:;",
          "object-src 'none';",
        ].join(" "),
      },
    });
  });

  // 개발 환경과 프로덕션 환경에서 다른 URL 로드
  const isDev = !app.isPackaged;
  if (isDev) {
    // 개발 환경: Vite 개발 서버 사용
    mainWindow.loadURL("http://localhost:3000");
  } else {
    // 프로덕션 환경: 빌드된 정적 파일 직접 로드
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
  }
}

function startFastAPIServer() {
  const isDev = !app.isPackaged;

  // 개발 환경에서는 현재 디렉토리 기준으로 경로 설정
  const scriptPath = isDev ? path.join(__dirname, "../../../backend/main.py") : path.join(process.resourcesPath, "backend", "main.py");

  // Python 경로 설정 - 가상환경이 있으면 사용, 없으면 시스템 Python 사용
  let pythonPath;
  const venvPath = isDev ? path.join(__dirname, "../../../venv/Scripts/python.exe") : path.join(process.resourcesPath, "venv/Scripts/python.exe");
  const systemPython = "python"; // 시스템 Python 사용

  try {
    const fs = require("fs");
    if (fs.existsSync(venvPath)) {
      pythonPath = venvPath;
      console.log("Electron: 가상환경 Python 사용:", pythonPath);
    } else {
      pythonPath = systemPython;
      console.log("Electron: 시스템 Python 사용:", pythonPath);
    }
  } catch (error) {
    pythonPath = systemPython;
    console.log("Electron: 시스템 Python 사용 (오류로 인해):", pythonPath);
  }

  console.log("Electron: FastAPI 스크립트 경로:", scriptPath);
  console.log("Electron: Python 경로:", pythonPath);

  // uvicorn을 사용하여 FastAPI 서버 시작
  const args = [scriptPath];
  const cwd = isDev ? path.join(__dirname, '../../../') : path.join(process.resourcesPath, 'backend');

  // 한글 인코딩을 위한 환경변수 설정
  const env = {
    ...process.env,
    LANG: "ko_KR.UTF-8",
    LC_ALL: "ko_KR.UTF-8",
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };

  fastapiProcess = spawn(pythonPath, args, {
    stdio: "pipe",
    cwd: cwd,
    env: env,
    shell: false,
    windowsHide: !isDev, // 개발 환경에서는 콘솔 창을 숨기지 않음
  });

  fastapiProcess.stdout.on("data", (data) => {
    // UTF-8로 디코딩하여 한글 출력
    const output = data.toString("utf8");
    console.log("FastAPI:", output);
  });

  fastapiProcess.stderr.on("data", (data) => {
    // UTF-8로 디코딩하여 한글 출력
    const output = data.toString("utf8");
    console.error("FastAPI Error:", output);
  });

  fastapiProcess.on("error", (error) => {
    console.error("Electron: FastAPI 프로세스 시작 실패:", error);
  });

  fastapiProcess.on("close", (code) => {
    console.log("Electron: FastAPI 프로세스 종료, 코드:", code);
  });
}

// React 정적 서버는 더 이상 필요하지 않음 (빌드된 앱에서는 직접 파일 로드)

// 강력한 종료 처리 함수
async function cleanupAndExit() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Electron: 앱 종료 절차 시작...');

  const processesToKill = [fastapiProcess].filter(p => p && !p.killed);

  if (processesToKill.length === 0) {
    console.log('종료할 자식 프로세스가 없습니다.');
    return; // Promise가 즉시 resolve되도록 return
  }

  console.log('모든 자식 프로세스를 종료합니다...');
  
  // 모든 자식 프로세스가 종료될 때까지 기다리는 Promise 생성
  const killPromises = processesToKill.map(p => {
    return new Promise((resolve, reject) => {
      // 프로세스가 종료되었을 때 resolve 호출
      p.on('exit', (code, signal) => {
        console.log(`프로세스 PID ${p.pid}가 코드 ${code}, 신호 ${signal}로 종료되었습니다.`);
        resolve();
      });

      // 만약의 사태를 대비한 타임아웃
      const timeout = setTimeout(() => {
        console.warn(`프로세스 PID ${p.pid}가 시간 내에 종료되지 않았습니다.`);
        resolve(); // 타임아웃 시에도 일단 resolve하여 앱 종료를 막지 않음
      }, 2000); // 2초 타임아웃

      p.on('exit', () => clearTimeout(timeout)); // 정상 종료 시 타임아웃 제거

      // 프로세스 종료 실행
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", p.pid, '/f', '/t']);
        } else {
          // spawn 옵션에 detached: true가 필요합니다.
          process.kill(-p.pid, 'SIGKILL');
        }
      } catch (e) {
        console.error(`프로세스 PID ${p.pid} 종료 중 오류 발생:`, e);
        resolve(); // 오류 발생 시에도 resolve
      }
    });
  });

  // 모든 프로세스가 종료될 때까지 대기
  await Promise.all(killPromises);
  console.log('모든 자식 프로세스가 정리되었습니다.');
}

app.whenReady().then(() => {
  createWindow();
  startFastAPIServer();
  connectBackendWebSocket(); // 백엔드 WebSocket 연결 시작

  // F11로 전체화면 토글
  globalShortcut.register("F11", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // Esc로 전체화면 해제
  globalShortcut.register("Esc", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(false);
    }
  });

  // 개발자 도구 단축키 설정 (F12)
  globalShortcut.register("F12", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 앱이 종료되기 직전, 단 한 번만 실행되는 최종 정리 로직
app.on('before-quit', async (event) => {
  if (!isShuttingDown) {
    event.preventDefault(); // 기본 종료 동작을 막고, 아래의 비동기 정리 작업이 끝날 때까지 대기
    console.log('before-quit 이벤트: 모든 리소스 정리 시작.');
    
    await cleanupAndExit(); // 직접 만든 정리 함수가 끝날 때까지 기다림
    
    isShuttingDown = true; // 플래그를 다시 설정
    app.quit(); // 모든 정리가 끝났으니, 이제 진짜로 앱을 종료
  }
});

// 종료 직전 모든 단축키 해제
app.on("will-quit", (event) => {
  globalShortcut.unregisterAll();
});

// SSL 인증서 오류 무시 (개발 환경에서만! 운영에서는 절대 사용 금지)
app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true); // SSL 인증서 오류 무시
});

// 프로세스 종료 시그널 처리
process.on("SIGINT", () => {
  console.log("Electron: SIGINT 수신 (Ctrl+C)");
  // 강제 종료 시 즉시 스토어 클리어
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript(`
        if (window.clearAllStores) {
          window.clearAllStores();
        }
      `);
    } catch (e) {
      console.error('강제 종료 시 스토어 클리어 실패:', e);
    }
  }
  app.quit();
});

process.on("SIGTERM", () => {
  console.log("Electron: SIGTERM 수신");
  // 강제 종료 시 즉시 스토어 클리어
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript(`
        if (window.clearAllStores) {
          window.clearAllStores();
        }
      `);
    } catch (e) {
      console.error('강제 종료 시 스토어 클리어 실패:', e);
    }
  }
  app.quit();
});

// 예상치 못한 종료 처리. 정리 불가하므로 로그만 남김
process.on("exit", (code) => {
  console.log("Electron: 프로세스 종료, 코드:", code);
});

process.on("uncaughtException", (error) => {
  console.error("Electron: 예상치 못한 오류:", error);
  if (!isShuttingDown) cleanupAndExit();
});

// 프로세스가 강제 종료될 때의 처리
process.on("unhandledRejection", (reason, promise) => {
  console.error("Electron: 처리되지 않은 Promise 거부:", reason);
  cleanupAndExit();
});

// 추가: 프로세스 종료 전 최종 정리
process.on("beforeExit", (code) => {
  console.log("Electron: 프로세스 종료 전 정리 시작");
  if (!isShuttingDown) {
    cleanupAndExit();
  }
});

ipcMain.on("toggle-fullscreen", () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

// Renderer → Backend WS 메시지 및 제어
ipcMain.on('ws:send', (_evt, payload) => {
  if (backendWs && backendWs.readyState === WebSocket.OPEN) {
    try {
      const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
      backendWs.send(msg);
    } catch (_) {}
  }
});

ipcMain.on('ws:reconnect', () => {
  wsRetryCount = 0;
  connectBackendWebSocket();
});

ipcMain.on('ws:disconnect', () => {
  if (backendWs) {
    try { backendWs.close(1000, 'Client requested'); } catch (_) {}
  }
});

// preload 스크립트에서 전달된 콘솔 로그 처리
ipcMain.on("console-log", (event, { level, message }) => {
  const timestamp = new Date().toISOString();
  console.log(`[Renderer ${level.toUpperCase()}] ${message} (${timestamp})`);
});

// Electron에서 외부 브라우저 열기
function createAuthWindow(loginUrl) {
  const authWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      sandbox: true,
    },
  });

  // 소셜 로그인 창의 CSP 헤더 설정
  authWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' https: http:;",
          "script-src 'self' 'unsafe-inline' https: http:;",
          "style-src 'self' 'unsafe-inline' https: http:;",
          "img-src 'self' blob: data: https: http:;",
          "connect-src 'self' https: http:;",
          "frame-src 'self' https: http:;",
        ].join(" "),
      },
    });
  });

  return authWindow;
}

// OAuth 로그인 핸들러 수정
ipcMain.handle("oauth-login", async (event, provider) => {
  let loginUrl = "";

  if (provider === "google") {
    loginUrl = "https://i13a108.p.ssafy.io/oauth2/authorization/google";
  } else if (provider === "kakao") {
    loginUrl = "https://i13a108.p.ssafy.io/oauth2/authorization/kakao";
  } else if (provider === "naver") {
    loginUrl = "https://i13a108.p.ssafy.io/oauth2/authorization/naver";
  }

  const authWindow = createAuthWindow(loginUrl);
  authWindow.loadURL(loginUrl);

  // 리다이렉트 URL 감지
  authWindow.webContents.on("will-navigate", (event, url) => {
    handleCallback(url, authWindow);
  });

  authWindow.webContents.on("will-redirect", (event, url) => {
    handleCallback(url, authWindow);
  });

  // 창이 닫힐 때 처리
  authWindow.on("closed", () => {
    mainWindow.webContents.send("oauth-closed");
  });
});

// ✅ 콜백 URL → mainWindow로 그대로 전달
function handleCallback(url, authWindow) {
  if (url.includes("/auth/redirect")) {
    // 최종 URL이 완전히 로드된 후 mainWindow 이동
    authWindow.webContents.on("did-finish-load", () => {
      mainWindow.loadURL("http://localhost:3000/#/auth/redirect");
      authWindow.close();
    });

    // authWindow는 최종 URL을 그대로 렌더링하게 둠
    authWindow.loadURL(url);
  }
}

// 오디오 파일을 Data URL로 읽어 반환
ipcMain.handle('read-audio-as-data-url', async (event, filePath) => {
  try {
    if (!filePath) {
      return null;
    }
    
    const exists = fs.existsSync(filePath);
    if (!exists) {
      return null;
    }
    
    const ext = (path.extname(filePath).slice(1) || '').toLowerCase();
    const mimeByExt = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      flac: 'audio/flac'
    };
    const mime = mimeByExt[ext] || 'application/octet-stream';
    
    const buf = fs.readFileSync(filePath);
    const base64 = buf.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    return dataUrl;
  } catch (e) {
    console.error('오디오 Data URL 변환 실패:', e);
    return null;
  }
});

// 일반 파일을 Data URL로 읽어서 반환 (비디오/오디오/이미지 등)
ipcMain.handle('read-file-as-data-url', async (event, filePath) => {
  try {
    if (!filePath) return null;
    const exists = fs.existsSync(filePath);
    if (!exists) return null;
    const ext = (path.extname(filePath).slice(1) || '').toLowerCase();
    const mimeByExt = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
      m4v: 'video/x-m4v',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg'
    };
    const mime = mimeByExt[ext] || 'application/octet-stream';
    const buf = fs.readFileSync(filePath);
    const base64 = buf.toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    console.error('read-file-as-data-url 실패:', e);
    return null;
  }
});

// 비디오 저장 핸들러 (webm -> mp4 변환 포함)
ipcMain.handle('save-video', async (_evt, { arrayBuffer, suggestedName }) => {
  try {
    const ffmpegPath = getFfmpegPath();
    console.log('[main] ffmpeg path =', ffmpegPath || '(none)');

    // 저장 위치 (초기값은 mp4로)
    const { canceled, filePath: chosen } = await dialog.showSaveDialog({
      title: '녹화 저장',
      defaultPath: suggestedName || `recording-${Date.now()}.mp4`,
      filters: [
        { name: 'MP4', extensions: ['mp4'] },
        { name: 'WebM', extensions: ['webm'] }
      ]
    });
    if (canceled || !chosen) return { ok: false, canceled: true };

    const buf = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
    const tmpWebm = path.join(app.getPath('temp'), `rec-${Date.now()}.webm`);
    fs.writeFileSync(tmpWebm, buf);

    const ext = (path.extname(chosen) || '').toLowerCase();

    // ① ffmpeg 있으면 -> 무조건 mp4로 저장 (확장자 없거나 webm이어도 mp4로 강제)
    if (ffmpegPath) {
      const targetMp4 = ext === '.mp4' ? chosen : `${chosen.replace(/\.(webm|)$/i, '')}.mp4`;
      console.log('[main] try convert to mp4 =>', targetMp4);

      await new Promise((resolve, reject) => {
        const args = [
          '-y',
          '-i', tmpWebm,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          targetMp4
        ];
        execFile(ffmpegPath, args, (err, so, se) => {
          try { fs.unlinkSync(tmpWebm); } catch {}
          if (err) {
            console.error('[main] ffmpeg failed:', se?.toString?.() || err);
            return reject(err);
          }
          resolve();
        });
      });

      console.log('[main] saved MP4:', targetMp4);
      return { ok: true, filePath: targetMp4, usedFfmpeg: true };
    }

    // ② ffmpeg 없으면 -> WebM으로 저장 (사용자 선택 확장자 무시하고 확실히 webm로)
    const targetWebm = ext === '.webm' ? chosen : `${chosen.replace(/\.(mp4|)$/i, '')}.webm`;
    fs.copyFileSync(tmpWebm, targetWebm);
    try { fs.unlinkSync(tmpWebm); } catch {}
    console.warn('[main] ffmpeg not found. saved WebM:', targetWebm);
    return { ok: true, filePath: targetWebm, usedFfmpeg: false };

  } catch (e) {
    console.error('[main] save-video error:', e);
    return { ok: false, error: e?.message || String(e) };
  }
});

// 트리 구성 헬퍼 함수
const buildAudioTree = (dirPath) => {
  const audioExts = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aac', '.m4a']);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const children = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const folderNode = {
        type: 'folder',
        name: entry.name,
        id: fullPath,
        children: buildAudioTree(fullPath)
      };
      if (folderNode.children.length > 0) children.push(folderNode);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (audioExts.has(ext)) {
        children.push({
          type: 'file',
          name: entry.name,
          id: fullPath
        });
      }
    }
  }
  // 이름 기준 정렬: 폴더 우선, 그 다음 파일
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
  return children;
};

// 기본 samples 폴더 로드 핸들러
ipcMain.handle('load-default-samples', async () => {
  try {
    const isDev = !app.isPackaged;
    const samplesPath = isDev 
      ? path.join(__dirname, '../../../backend/samples') 
      : path.join(process.resourcesPath, 'backend/samples');
    
    if (!fs.existsSync(samplesPath)) {
      console.log('기본 samples 폴더가 존재하지 않습니다:', samplesPath);
      return null;
    }

    const tree = [
      {
        type: 'folder',
        name: 'samples',
        id: samplesPath,
        children: buildAudioTree(samplesPath)
      }
    ];

    return { folderPath: samplesPath, tree };
  } catch (e) {
    console.error('기본 samples 폴더 로드 중 오류:', e);
    return null;
  }
});

// 샘플 폴더 선택 및 트리 구성 핸들러
ipcMain.handle('select-sample-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    const folderPath = result.filePaths[0];

    const tree = [
      {
        type: 'folder',
        name: path.basename(folderPath),
        id: folderPath,
        children: buildAudioTree(folderPath)
      }
    ];

    return { folderPath, tree };
  } catch (e) {
    console.error('샘플 폴더 선택 처리 중 오류:', e);
    return null;
  }
});
