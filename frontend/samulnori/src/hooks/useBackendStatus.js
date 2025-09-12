import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * 백엔드 상태 관리 Hook (`/status` 라우터 기반)
 * @param {string} baseUrl - 백엔드 서버의 기본 URL
 * @param {number} interval - 상태를 폴링하는 주기 (ms)
 * @returns {object} 백엔드 상태와 제어 함수들
 */
const useBackendStatus = (baseUrl = 'http://localhost:8000', interval = 2000) => {
  // 백엔드의 모든 상태를 담는 객체
  const [status, setStatus] = useState({
    running: false,
    webcam_on: false,
    glove_on: false,
    yolo_on: false,
    mediapipe_on: false,
    streaming: false,
  });

  // 연결 자체의 상태
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const intervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // GET /status API를 호출하여 상태를 가져오는 함수
  const fetchStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`${baseUrl}/api/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`서버 응답: ${response.status}`);

      const data = await response.json();
      setStatus(data);
      setIsConnected(true);
      if (error) setError(null); // 성공 시 에러 초기화
      if (retryCount > 0) setRetryCount(0); // 성공 시 재시도 횟수 초기화
    } catch (err) {
      setIsConnected(false);
      setError(err.message);
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, error, retryCount]);

  // POST /status/{key}/{value} API를 호출하여 상태를 변경하는 함수
  const updateStatus = useCallback(
    async (key, value) => {
      if (!isConnected) {
        console.warn('백엔드 연결이 없어 상태를 변경할 수 없습니다.');
        return;
      }
      
      console.log(`=== 상태 변경 요청 ===`);
      console.log(`키: ${key}, 값: ${value}`);
      console.log(`URL: ${baseUrl}/api/status/${key}/${value}`);
      
      try {
        const response = await fetch(`${baseUrl}/api/status/${key}/${value}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log(`응답 상태: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`서버 응답: ${response.status}`);
        }
        
        console.log(`상태 변경 성공: ${key}=${value}`);
        
        // 상태 변경 후 즉시 최신 상태를 다시 가져옴
        await fetchStatus();
      } catch (err) {
        console.error(`상태 업데이트 실패: ${err.message}`);
        setError(`상태 업데이트 실패: ${err.message}`);
      }
    },
    [baseUrl, isConnected, fetchStatus]
  );

  // 수동으로 재연결 시도
  const retryConnection = useCallback(() => {
    setRetryCount(0);
    setIsLoading(true);
    setError(null);
    fetchStatus();
  }, [fetchStatus]);

  // 주기적인 폴링 및 자동 재연결 로직
  useEffect(() => {
    // 초기 즉시 실행
    fetchStatus();
    // 주기적 폴링 설정
    intervalRef.current = setInterval(fetchStatus, interval);

    // 컴포넌트 언마운트 시 정리
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(retryTimeoutRef.current);
    };
  }, [fetchStatus, interval]);

  // 연결 실패 시 지수 백오프 재시도
  useEffect(() => {
    if (!isConnected && retryCount > 0) {
      const delay = Math.min(1000 * 2 ** (retryCount - 1), 30000); // 최대 30초
      retryTimeoutRef.current = setTimeout(fetchStatus, delay);
    }
    return () => clearTimeout(retryTimeoutRef.current);
  }, [isConnected, retryCount, fetchStatus]);


  // 자주 사용하는 상태 변경 함수들을 미리 정의 (메모이제이션)
  const controls = useMemo(() => ({
    startWebcam: () => updateStatus('webcam_on', 'true'),
    stopWebcam: () => updateStatus('webcam_on', 'false'),
    startGlove: () => updateStatus('glove_on', 'true'),
    stopGlove: () => updateStatus('glove_on', 'false'),
    startYolo: () => updateStatus('yolo_on', 'true'),
    stopYolo: () => updateStatus('yolo_on', 'false'),
    startMediapipe: () => updateStatus('mediapipe_on', 'true'),
    stopMediapipe: () => updateStatus('mediapipe_on', 'false'),
    startStreaming: () => updateStatus('streaming', 'true'),
    stopStreaming: () => updateStatus('streaming', 'false'),
  }), [updateStatus]);

  return {
    // 연결 상태
    isConnected,
    isLoading,
    error,
    
    // 백엔드 상태
    status,
    running: status.running,
    webcamOn: status.webcam_on,
    gloveOn: status.glove_on,
    yoloOn: status.yolo_on,
    mediapipeOn: status.mediapipe_on,
    streaming: status.streaming,
    
    // 제어 함수
    retryConnection,
    updateStatus,
    ...controls,
  };
};

export default useBackendStatus;