import React, { createContext, useContext, useEffect, useState } from 'react';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [typeHandlers, setTypeHandlers] = useState(new Map());
  const [stableConnected, setStableConnected] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);

  // IPC 기반 상태/메시지 구독
  useEffect(() => {
    if (!window.ws) return;
    const handleStatus = (s) => {
      setConnected(!!s?.connected);
      setRetryCount(Number(s?.retryCount || 0));
      setError(s?.error || null);
    };
    const handleMessage = (msg) => {
      // 기존 훅과 동일한 인터페이스 유지: { data }
      setLastMessage({ data: msg });
    };
    window.ws.onStatus(handleStatus);
    window.ws.onMessage(handleMessage);
    return () => {
      window.ws.offAll();
    };
  }, []);

  // 연결 상태에 안정성을 위한 timeout 적용
  useEffect(() => {
    let timeoutId;
    if (connected) {
      setStableConnected(true);
    } else {
      timeoutId = setTimeout(() => {
        setStableConnected(false);
      }, 2000);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [connected]);

  // type별 핸들러 등록 함수
  const registerHandler = (type, handler) => {
    let cleanup;
    setTypeHandlers(prev => {
      const newMap = new Map(prev);
      const set = newMap.get(type) || new Set();
      if (!set.has(handler)) {
        set.add(handler);
        newMap.set(type, set);
      }
      // cleanup은 현재 클로저 내에서 한 번만 생성
      cleanup = () => {
        setTypeHandlers(prev2 => {
          const copy = new Map(prev2);
          const current = copy.get(type);
          if (!current) return copy;
          const next = new Set(current);
          next.delete(handler);
          if (next.size === 0) {
            copy.delete(type);
          } else {
            copy.set(type, next);
          }
          return copy;
        });
      };
      return newMap;
    });
    return () => cleanup && cleanup();
  };

  // type별 핸들러 해제 함수
  const unregisterHandler = (type, handler) => {
    setTypeHandlers(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(type);
      if (!existing) return newMap;
      if (!existing.has(handler)) return newMap;
      const next = new Set(existing);
      next.delete(handler);
      if (next.size === 0) newMap.delete(type); else newMap.set(type, next);
      return newMap;
    });
  };

  // WebSocket 메시지 분배: type별로 핸들러 호출
  useEffect(() => {
    if (!lastMessage) return;
    
    let type = null;
    let parsed = null;
    
    // 바이너리 데이터인지 확인 (ArrayBuffer 또는 Blob)
    if (lastMessage.data instanceof ArrayBuffer || lastMessage.data instanceof Blob) {
      type = 'frame';
      parsed = lastMessage.data;
    } else {
      // 텍스트 데이터인 경우 JSON 파싱 시도
      try {
        parsed = JSON.parse(lastMessage.data);
        type = parsed.type || (typeof parsed === 'string' ? parsed : null);
      } catch {
        // JSON 파싱 실패 시 텍스트 데이터를 그대로 사용
        type = 'frame';
        parsed = lastMessage.data;
      }
    }
    
    if (!type) {
      return;
    }
    
    const handlers = typeHandlers.get(type);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(parsed, lastMessage);
        } catch (e) {
          console.error('WebSocket 핸들러 오류:', e);
        }
      });
    }
  }, [lastMessage, typeHandlers]);

  const contextValue = {
    connected: stableConnected,
    rawConnected: connected,
    error,
    retryCount,
    lastMessage,
    reconnect: () => window.ws?.reconnect?.(),
    disconnect: () => window.ws?.disconnect?.(),
    send: (payload) => window.ws?.send?.(payload),
    registerHandler,
    unregisterHandler
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket은 WebSocketProvider 내부에서 사용되어야 합니다.');
  }
  return context;
}

export function useWebSocketMessage(type, messageHandler, deps = []) {
  const { registerHandler } = useWebSocket();
  
  React.useEffect(() => {
    if (!messageHandler) return;
    // 동일 핸들러 중복 등록 방지: deps로 안정화된 핸들러를 기대
    const cleanup = registerHandler(type, messageHandler);
    return () => {
      try { cleanup(); } catch (_) {}
    };
  }, [type, messageHandler, ...deps]);
}

export default WebSocketContext;