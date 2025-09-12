import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import useObjectDetection from '../../hooks/useObjectDetection';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import useTouchEvents from '../../hooks/useTouchEvents';
import useHandsInfo from '../../hooks/useHandsInfo';
import {
  generateObjectColor,
  generateBorderColor,
  filterValidObjects
} from '../../utils/objectOverlay';

/**
 * 선택된 사물만 표시하는 오버레이 컴포넌트
 * - 소리 매핑 단계에서 사용
 * - 선택된 사물만 표시하고 클릭 시 사물 선택/해제
 */
function ObjectOverlaySelected({
  selectedObjects,
  onObjectClick,
  containerStyle,
  onSelectedObjectChange, // 선택된 사물 변경 시 호출되는 콜백
  selectedObjectForMapping, // 추가: 외부에서 선택 해제 신호를 받기 위함
  svgRef
}) {
  // 현재 선택된 사물의 trackId (단일 선택)
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const lastSeenRef = useRef(new Map());
  
  // 객체 정보
  const { objects, inferenceData } = useObjectDetection();
  
  // 전역 Storage에서 선택된 사물 key 값들과 소리 매핑 관리
  const { selectedObjectKeys, objectSoundMapping, setObjectSoundMapping, removeObjectsWithApi } = useObjectSelectionStore();
  const objectFingerSoundMapping = useObjectSelectionStore(state => state.objectFingerSoundMapping);
  const { isObjectActive } = useTouchEvents(600);
  const { hands } = useHandsInfo();
  const trailsRef = useRef(new Map());
  const OBJ_TRAIL_WINDOW_MS = 800;

  // 주기적으로 사물 생존 체크 (5초 이상 미표시 시 제거)
  useEffect(() => {
    const now = Date.now();
    const currentIds = new Set(objects.map(o => o.trackId));

    // 현재 보이는 것들 타임스탬프 업데이트
    objects.forEach((o) => {
      lastSeenRef.current.set(o.trackId, now);
    });

    // 선택 목록 중 오래 안 보인 것들 제거 후보
    const staleIds = (selectedObjectKeys || []).filter((id) => {
      const last = lastSeenRef.current.get(id) || 0;
      return now - last > 7000; // 7초
    });

    if (staleIds.length > 0) {
      removeObjectsWithApi(staleIds);
      setToastMessage('사물 정보가 변경되었습니다. 다른 사물을 설정해보세요!');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 5000);
      // 현재 선택도 해제
      if (staleIds.includes(selectedObjectId)) {
        setSelectedObjectId(null);
        if (onSelectedObjectChange) onSelectedObjectChange(null);
      }
    }
  }, [objects, selectedObjectKeys, removeObjectsWithApi, onSelectedObjectChange, selectedObjectId]);

  // 유효한 객체만 필터링하고, 선택된 사물만 표시
  const validObjects = useMemo(() => {
    const filtered = filterValidObjects(objects);
    // 선택된 사물만 필터링
    const selected = filtered.filter(obj => selectedObjectKeys.includes(obj.trackId));
    return selected;
  }, [objects, selectedObjectKeys]);

  // 선택된 사물이 변경될 때 부모 컴포넌트에 알림
  useEffect(() => {
    if (onSelectedObjectChange && selectedObjectId) {
      const selectedObject = validObjects.find(obj => obj.trackId === selectedObjectId);
      if (selectedObject) {
        onSelectedObjectChange(selectedObject);
      }
    }
  }, [selectedObjectId, validObjects, onSelectedObjectChange]);

  // 객체 클릭 핸들러 - 사물 선택/해제
  const handleObjectClick = useCallback((object, index, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    // 현재 선택된 사물과 같은 사물을 클릭하면 선택 해제
    if (selectedObjectId === object.trackId) {
      setSelectedObjectId(null);
      if (onSelectedObjectChange) {
        onSelectedObjectChange(null);
      }
    } else {
      // 다른 사물을 클릭하면 해당 사물 선택
      setSelectedObjectId(object.trackId);
    }
  }, [selectedObjectId, onSelectedObjectChange, selectedObjectForMapping]);

  // 외부에서 선택 해제 신호를 받으면 내부 selectedObjectId를 null로 동기화
  useEffect(() => {
    if (!selectedObjectForMapping) {
      setSelectedObjectId(null);
      // 부모 컴포넌트에도 선택 해제를 알림
      if (onSelectedObjectChange) {
        onSelectedObjectChange(null);
      }
    }
  }, [selectedObjectForMapping, onSelectedObjectChange]);

  // SVG 스타일
  const svgStyle = useMemo(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  }), []);

  if (!validObjects.length) {
    return (
      <>
        {toastVisible && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 99999,
            background: 'rgba(17,24,39,0.95)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
          }}>
            {toastMessage}
          </div>
        )}
      </>
    );
  }

  return (
    <div style={containerStyle}>
      {toastVisible && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 99999,
          background: 'rgba(17,24,39,0.95)',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 8,
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
        }}>
          {toastMessage}
        </div>
      )}
      <svg
        width="100%"
        height="100%"
        style={svgStyle}
        ref={svgRef}
      >
        {/* 터치 그라데이션 정의 - 자연스러운 크로스페이드 */}
        <defs>
          <linearGradient id="touchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.9">
              <animate attributeName="stop-opacity" values="0.9;0.7;0.9" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stop-color" values="#00D4FF;#8B5CF6;#EC4899;#F59E0B;#00D4FF" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="25%" stopColor="#8B5CF6" stopOpacity="0.8">
              <animate attributeName="stop-opacity" values="0.8;0.6;0.8" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stop-color" values="#8B5CF6;#EC4899;#F59E0B;#00D4FF;#8B5CF6" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#EC4899" stopOpacity="0.7">
              <animate attributeName="stop-opacity" values="0.7;0.5;0.7" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stop-color" values="#EC4899;#F59E0B;#00D4FF;#8B5CF6;#EC4899" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.8">
              <animate attributeName="stop-opacity" values="0.8;0.6;0.8" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stop-color" values="#F59E0B;#00D4FF;#8B5CF6;#EC4899;#F59E0B" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.9">
              <animate attributeName="stop-opacity" values="0.9;0.7;0.9" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stop-color" values="#00D4FF;#8B5CF6;#EC4899;#F59E0B;#00D4FF" dur="4s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* 터치 시 빛나는 효과 */}
          <filter id="touchGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {validObjects.map((object, index) => {
          const fillColor = generateObjectColor(object.class_id);
          const borderColor = generateBorderColor(fillColor);
          const isCurrentlySelected = selectedObjectId === object.trackId; // 현재 선택된 사물인지 확인

          if (!fillColor || !borderColor) {
            return null;
          }

          if (!object.canvasPolygon || object.canvasPolygon.length < 3) {
            return null;
          }

          // 미리 생성된 문자열 사용 (성능 최적화)
          const points = object.canvasPolygonStr;
          
          // 레이블 위치를 사물의 중심점으로 고정
          let textX, textY;
          if (object.canvasBox) {
            // canvasBox: [x, y, width, height] - 중심점 기준
            textX = object.canvasBox[0]; // 중심 x 좌표
            textY = object.canvasBox[1] - 15; // 중심 y 좌표에서 위로 15px
          } else {
            // fallback: 기존 방식 (폴리곤 첫 번째 점 기준)
            textX = object.canvasPolygon[0][0];
            textY = object.canvasPolygon[0][1] - 10;
          }

          // 선택/활성/매핑 상태에 따른 스타일
          // 테스트용: 손가락과 폴리곤 겹치면 잔상 샘플 기록
          const now = Date.now();
          try {
            if (Array.isArray(hands) && hands.length > 0 && Array.isArray(object.canvasPolygon)) {
              for (const hand of hands) {
                if (!Array.isArray(hand.landmarks)) continue;
                for (const pt of hand.landmarks) {
                  if (isPointInPolygon(pt, object.canvasPolygon)) {
                    const arr = trailsRef.current.get(object.trackId) || [];
                    arr.push({ ts: now });
                    if (arr.length > 8) arr.splice(0, arr.length - 8);
                    trailsRef.current.set(object.trackId, arr);
                    break;
                  }
                }
              }
            }
          } catch (_) {}

          // 오래된 잔상 제거
          const prevTrails = trailsRef.current.get(object.trackId) || [];
          const filteredTrails = prevTrails.filter(s => now - s.ts <= OBJ_TRAIL_WINDOW_MS);
          trailsRef.current.set(object.trackId, filteredTrails);

          // 실제 터치 이벤트에 따른 활성화 상태
          const isActive = isObjectActive(object.trackId);
          const hasFingerMapping = (() => {
            const m = objectFingerSoundMapping?.[object.trackId] || { left: {}, right: {} };
            return ['left', 'right'].some((hand) => {
              const handMap = m[hand] || {};
              return Object.values(handMap).some((val) => {
                if (!val) return false;
                if (typeof val === 'object') return Boolean(val.id || val.name);
                if (typeof val === 'string') return val.length > 0;
                return false;
              });
            });
          })();
          const hasMapping = hasFingerMapping; // 손가락 매핑이 있는 경우만 '설정 완료'로 간주
          const selectedFillColor = fillColor.replace(/[\d.]+\)$/,'0.8)');
          // 활성/매핑 시 그라데이션 채움
          const gradientId = `grad-${object.trackId}`;
          const gradientFill = isActive
            ? `url(#${gradientId})`
            : (hasMapping ? `url(#${gradientId})` : selectedFillColor);

          let polyBorderColor = '#EC4899';
          let polyStrokeWidth = '6';
          let polyDash = '10,5';
          let polygonShadow;

          if (isActive) {
            polyBorderColor = '#00D4FF';
            polyStrokeWidth = '10';
            polyDash = '0';
            polygonShadow = 'drop-shadow(0 0 16px rgba(0,212,255,0.85))';
          } else if (isCurrentlySelected) {
            polyBorderColor = '#FF6B6B';
            polyStrokeWidth = '8';
            polyDash = 'none';
          } else if (hasMapping) {
            polyBorderColor = '#3B82F6'; // mapped: blue accent
            polyStrokeWidth = '6';
            polyDash = '6,4';
            polygonShadow = 'drop-shadow(0 0 12px rgba(59,130,246,0.7))';
          } else {
            polyBorderColor = '#EC4899';
            polyStrokeWidth = '6';
            polyDash = '10,5';
          }

          // 표시할 텍스트: class_name_trackId 형식
          const displayText = `${object.class_name}_${object.trackId}`;
          
          // 소리 매핑 표시(손가락 매핑 기준)
          const soundText = hasMapping ? ' (소리 설정됨)' : ' (소리 미설정)';

          return (
            <g
              key={object.trackId}
              onClick={e => handleObjectClick(object, index, e)}
              style={{ cursor: 'pointer' }} // 클릭 활성화
            >
              {/* 사물 테두리 */}
              {/* 그라데이션 정의 (활성/매핑) */}
              {(isActive || hasMapping) && (
                                 <defs>
                   <radialGradient id={gradientId} cx="50%" cy="50%" r="65%">
                     <stop offset="0%" stopColor={isActive ? 'rgba(0,212,255,0.85)' : 'rgba(59,130,246,0.55)'} />
                     <stop offset="60%" stopColor={isActive ? 'rgba(139,92,246,0.35)' : 'rgba(59,130,246,0.25)'} />
                     <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                   </radialGradient>
                 </defs>
              )}
              {/* 잔상(그라데이션 링) */}
              {filteredTrails.map((t, idx2) => {
                const age = now - t.ts;
                const k = Math.max(0, 1 - age / OBJ_TRAIL_WINDOW_MS);
                const gid = `${gradientId}-trail-${idx2}`;
                return (
                                     <defs key={`defs-${gid}`}>
                     <radialGradient id={gid} cx="50%" cy="50%" r="75%">
                       <stop offset="0%" stopColor={isActive ? 'rgba(0,212,255,0.25)' : 'rgba(59,130,246,0.25)'} />
                       <stop offset="80%" stopColor={isActive ? `rgba(139,92,246,${0.15*k})` : `rgba(59,130,246,${0.15*k})`} />
                       <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                     </radialGradient>
                   </defs>
                );
              })}
              <polygon
                points={points}
                fill={isActive ? 'url(#touchGradient)' : gradientFill}
                stroke={polyBorderColor}
                strokeWidth={polyStrokeWidth}
                strokeDasharray={polyDash}
                style={isActive ? { 
                  filter: 'url(#touchGlow)',
                  animation: 'touchPulse 1.5s ease-in-out infinite'
                } : (polygonShadow ? { filter: polygonShadow } : undefined)}
              />
              
              {/* 터치 시 추가 빛나는 효과 */}
              {isActive && (
                <polygon
                  points={points}
                  fill="none"
                  stroke="url(#touchGradient)"
                  strokeWidth="12"
                  strokeOpacity="0.3"
                  style={{
                    filter: 'blur(4px)',
                    animation: 'touchRipple 2s ease-out infinite'
                  }}
                />
              )}
              {filteredTrails.map((t, idx2) => (
                <polygon key={`trail-poly-${idx2}`}
                  points={points}
                  fill={`url(#${gradientId}-trail-${idx2})`}
                  stroke="none"
                  style={{ mixBlendMode: 'screen' }}
                />
              ))}
              {/* 사물 이름과 확률 */}
              <text
                x={textX}
                y={textY}
                                 fill={isActive ? '#00D4FF' : (isCurrentlySelected ? '#FF6B6B' : (hasMapping ? '#3B82F6' : '#EC4899'))}
                fontSize="14"
                fontWeight="bold"
                textAnchor="start"
                style={{
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  stroke: 'black',
                  strokeWidth: '0.5px'
                }}
              >
                {`${displayText}${isCurrentlySelected ? ' ★' : ' ✓'} (${(object.confidence * 100).toFixed(1)}%)${soundText}${hasMapping ? ' ♪' : ''}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default ObjectOverlaySelected; 