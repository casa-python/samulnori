import { useCallback, useMemo, useState } from 'react';
import useCameraStore from '../stores/cameraStore';
import { useWebSocketMessage } from '../contexts/WebSocketContext';

/**
 * WebSocket 'hand' 메시지를 구독해 손 좌표를 캔버스 좌표로 변환해 제공하는 훅
 * 메시지 스키마: { type: 'hand', data: [ { label: 'left'|'right', landmarks: [[x,y], ...7], fresh: boolean } ] }
 */
const useHandsInfo = () => {
  const { canvasRenderInfo, imageDimensions } = useCameraStore();
  const [rawHands, setRawHands] = useState([]);

  // frame 좌표 → 캔버스 좌표 변환
  const toCanvasCoords = useCallback(
    (point) => {
      if (!point || !Array.isArray(point) || point.length < 2) return [0, 0];
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!canvasRenderInfo || !imageDimensions) return [x, y];
      const { scaleX, scaleY, offsetX, offsetY } = canvasRenderInfo;
      return [
        x * scaleX + offsetX,
        y * scaleY + offsetY
      ];
    },
    [canvasRenderInfo, imageDimensions]
  );

  // WS 핸들러 등록 (핸들러 참조를 안정화하여 리렌더 루프 방지)
  const handleHandMessage = useCallback((msg) => {
    try {
      const list = Array.isArray(msg?.data) ? msg.data : [];
      setRawHands(list);
    } catch (_) {
      setRawHands([]);
    }
  }, []);

  useWebSocketMessage('hand', handleHandMessage, [handleHandMessage]);

  // 캔버스 좌표로 변환된 결과
  const hands = useMemo(() => {
    if (!rawHands || rawHands.length === 0) return [];
    return rawHands.map((h) => {
      const landmarks = Array.isArray(h?.landmarks)
        ? h.landmarks.map((pt) => toCanvasCoords(pt))
        : [];
      return {
        label: h?.label === 'right' ? 'right' : 'left',
        fresh: !!h?.fresh,
        landmarks
      };
    });
  }, [rawHands, toCanvasCoords]);

  return { hands };
};

export default useHandsInfo;


