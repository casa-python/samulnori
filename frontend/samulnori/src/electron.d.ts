export interface ElectronAPI {
  oauthLogin: (provider: string) => void;
  loadDefaultSamples: () => Promise<{ folderPath: string; tree: any[] } | null>;
  selectSampleFolder: () => Promise<{ folderPath: string; tree: any[] } | null>;
  readAudioAsDataUrl: (filePath: string) => Promise<string | null>;
  readFileAsDataUrl: (filePath: string) => Promise<string | null>;
  saveVideo: (arrayBuffer: ArrayBuffer, suggestedName?: string) => Promise<{ ok: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  onAppExit: (callback: () => void) => void;
  sendConsoleLog: (level: 'log' | 'warn' | 'error' | 'info', message: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    ws: {
      onStatus: (cb: (s: { connected: boolean; retryCount?: number; error?: string | null }) => void) => void;
      onMessage: (cb: (msg: any) => void) => void;
      offAll: () => void;
      send: (payload: any) => void;
      reconnect: () => void;
      disconnect: () => void;
    };
  }
} 