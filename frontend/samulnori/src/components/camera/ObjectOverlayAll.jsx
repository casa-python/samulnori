import React, { useMemo, useCallback } from 'react';
import useObjectDetection from '../../hooks/useObjectDetection';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import useTouchEvents from '../../hooks/useTouchEvents';
import {
  generateObjectColor,
  generateBorderColor,
  filterValidObjects
} from '../../utils/objectOverlay';

/**
 * 모든 사물을 표시하는 오버레이 컴포넌트
 * - 사물 선택 단계에서 사용
 * - 모든 사물을 표시하고 클릭 가능
 */
function ObjectOverlayAll({
  selectedObjects,
  onObjectClick,
  containerStyle,
  svgRef
}) {
  // 객체 정보
  const { objects, inferenceData } = useObjectDetection();
  
  // 전역 Storage에서 선택된 사물 key 값들 가져오기
  const { selectedObjectKeys } = useObjectSelectionStore();
  const { isObjectActive } = useTouchEvents(600);

  // 유효한 객체만 필터링 (모든 사물 표시)
  const validObjects = useMemo(() => {
    const filtered = filterValidObjects(objects);
    return filtered;
  }, [objects]);

  // 객체 클릭 핸들러
  const handleObjectClick = useCallback((object, index, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onObjectClick) {
      onObjectClick(object, index);
    }
  }, [onObjectClick]);

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
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{
          background: 'white',
          padding: '2rem 3rem',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#333',
          textAlign: 'center'
        }}>
          사물을 인식 중입니다...
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
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
          const isSelected = selectedObjectKeys.includes(object.trackId);

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

          // 실제 터치 이벤트에 따른 활성화 상태
          const isActive = isObjectActive(object.trackId);
          const selectedFillColor = isSelected
            ? fillColor.replace(/[\d.]+\)$/,'0.8)')
            : fillColor;
          
          // 터치 시 그라데이션 효과
          const glowColor = isActive 
            ? 'url(#touchGradient)' 
            : selectedFillColor;
          const selectedBorderColor = isActive ? '#00D4FF' : (isSelected ? '#EC4899' : borderColor);
          const strokeWidth = isActive ? '8' : (isSelected ? '6' : '2');

          // 표시할 텍스트: class_name_trackId 형식
          const displayText = `${object.class_name}_${object.trackId}`;

          return (
            <g
              key={object.trackId}
              onClick={e => handleObjectClick(object, index, e)}
              style={{ cursor: 'pointer' }}
            >
              {/* 사물 테두리 */}
              <polygon
                points={points}
                fill={glowColor}
                stroke={selectedBorderColor}
                strokeWidth={strokeWidth}
                strokeDasharray={isActive ? '0' : (isSelected ? '10,5' : 'none')}
                style={isActive ? { 
                  filter: 'url(#touchGlow)',
                  animation: 'touchPulse 1.5s ease-in-out infinite'
                } : undefined}
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
              {/* 사물 이름과 확률 */}
              <text
                x={textX}
                y={textY}
                fill={isSelected ? '#EC4899' : 'white'}
                fontSize={isSelected ? '14' : '12'}
                fontWeight="bold"
                textAnchor="start"
                style={{
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  stroke: 'black',
                  strokeWidth: '0.5px'
                }}
              >
                {`${displayText}${isSelected ? ' ✓' : ''} (${(object.confidence * 100).toFixed(1)}%)`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default ObjectOverlayAll; 