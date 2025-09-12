import { useCallback, useMemo } from 'react';
import { downsamplePolygon } from '../utils/objectOverlay';
import useCameraStore from '../stores/cameraStore';
import { useWebSocketMessage } from '../contexts/WebSocketContext';

/**
 * 객체 탐지(inference) 메시지만 처리하는 hook
 * 'inference' 타입 메시지에만 반응
 * 오버레이에서 바로 사용할 수 있도록 객체 정보 가공 데이터도 제공
 * (캔버스 기준 polygon, box 좌표까지 변환)
 */
const useObjectDetection = () => {
  const {
    setInferenceData,
    inferenceData,
    imageDimensions,
    canvasRenderInfo
  } = useCameraStore();

  // inference 메시지 처리
  const handleInferenceMessage = useCallback((msg) => {
    if (msg && msg.data) {
      setInferenceData(msg.data);
    }
  }, [setInferenceData]);

  useWebSocketMessage('inference', handleInferenceMessage, []);

  // 원본 이미지 좌표 → 캔버스 좌표 변환 함수
  const toCanvasCoords = useCallback(
    ([x, y]) => {
      if (!canvasRenderInfo || !imageDimensions) return [x, y];
      const { scaleX, scaleY, offsetX, offsetY } = canvasRenderInfo;
      return [
        x * scaleX + offsetX,
        y * scaleY + offsetY
      ];
    },
    [canvasRenderInfo, imageDimensions]
  );

  // 오버레이에서 바로 사용할 수 있도록 객체 정보 가공 (캔버스 기준 polygon, box 포함)
  const objects = useMemo(() => {
    if (!inferenceData) return [];
    const list = Object.entries(inferenceData).map(([trackId, obj]) => {
      const rawPolygon = obj.segmentation && Array.isArray(obj.segmentation)
        ? obj.segmentation.map(([x, y]) => toCanvasCoords([x, y]))
        : null;

      // 다각형 점 수 축소 및 문자열 생성 (성능 최적화)
      const canvasPolygon = rawPolygon ? downsamplePolygon(rawPolygon, 128) : null;
      const canvasPolygonStr = canvasPolygon
        ? canvasPolygon.map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ')
        : null;
      let canvasBox = null;
      if (obj.tlwh && Array.isArray(obj.tlwh) && canvasRenderInfo) {
        const [left, top, width, height] = obj.tlwh;
        const [x, y] = toCanvasCoords([left, top]);
        canvasBox = [
          x,
          y,
          width * canvasRenderInfo.scaleX,
          height * canvasRenderInfo.scaleY
        ];
      }
      return {
        ...obj,
        trackId: Number(trackId),
        canvasPolygon,
        canvasPolygonStr,
        canvasBox
      };
    });
    try { window.__latestCameraObjects = list; } catch (_) {}
    return list;
  }, [inferenceData, toCanvasCoords, canvasRenderInfo]);

  return { objects, inferenceData };
};

export default useObjectDetection;