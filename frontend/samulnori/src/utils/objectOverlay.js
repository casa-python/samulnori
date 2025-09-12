/**
 * 사물 테두리 생성 유틸리티
 */

// 색상 팔레트
export const COLOR_PALETTE = [
  'rgba(255, 0, 0, 0.3)',     // 빨간색
  'rgba(0, 255, 0, 0.3)',     // 초록색
  'rgba(0, 0, 255, 0.3)',     // 파란색
  'rgba(255, 255, 0, 0.3)',   // 노란색
  'rgba(255, 0, 255, 0.3)',   // 마젠타
  'rgba(0, 255, 255, 0.3)',   // 시안
];

/**
 * class_id 기반으로 고유 색상 생성
 */
export const generateObjectColor = (classId) => {
  if (classId === null || classId === undefined) {
    return COLOR_PALETTE[0];
  }
  const colorIndex = Math.abs(classId) % COLOR_PALETTE.length;
  return COLOR_PALETTE[colorIndex];
};

/**
 * 테두리 색상 생성
 */
export const generateBorderColor = (fillColor) => {
  if (!fillColor) return null;
  return fillColor.replace(/[\d.]+\)$/,'0.8)');
};

/**
 * 다각형 점 수를 균등 샘플링으로 줄여 성능 개선
 * - points: [[x,y], ...]
 * - maxPoints: 남길 최대 점 수
 */
export const downsamplePolygon = (points, maxPoints = 128) => {
  const total = Array.isArray(points) ? points.length : 0;
  if (total <= maxPoints) return points;
  const step = Math.ceil(total / maxPoints);
  const result = [];
  for (let i = 0; i < total; i += step) {
    result.push(points[i]);
  }
  // 마지막 점이 누락되어 시각적 단절이 보이면 마지막 점 추가
  if (result[result.length - 1] !== points[total - 1]) {
    result.push(points[total - 1]);
  }
  return result;
};

// class_id → { fill, border } 캐시
const classColorCache = new Map();
export const getColorsByClass = (classId) => {
  if (classColorCache.has(classId)) return classColorCache.get(classId);
  const fill = generateObjectColor(classId);
  const border = generateBorderColor(fill);
  const value = { fill, border };
  classColorCache.set(classId, value);
  return value;
};

/**
 * 유효한 객체 필터링
 */
export const filterValidObjects = (objects) => {
  if (!objects || !Array.isArray(objects)) return [];
  return objects.filter(obj =>
    obj &&
    obj.class_name !== 'person' &&
    obj.class_name !== 'dining table' &&
    obj.canvasPolygon &&
    Array.isArray(obj.canvasPolygon) &&
    obj.canvasPolygon.length >= 3
  );
};

/**
 * 선택 상태 확인
 */
export const isObjectSelected = (object, index, selectedObjects) => {
  return selectedObjects?.some(selected =>
    selected.trackId === object.trackId
  );
};