import React, { useMemo } from 'react';
import useHandsInfo from '../../hooks/useHandsInfo';
import useTouchEvents from '../../hooks/useTouchEvents';

/**
 * 손가락/손바닥 좌표를 초록 점으로 표시하는 오버레이
 * - props: svgRef(optional), containerStyle(optional)
 * - 웹소켓에서 받아오는 hand와 sensor 정보를 직접 사용
 */
const HandsOverlay = ({ svgRef, containerStyle }) => {
  const { hands } = useHandsInfo();
  // 손가락은 'on' 신호가 오면 유지, 'off'에서 해제(훅 로직)
  const { isFingerActive } = useTouchEvents(400);

  const svgStyle = useMemo(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  }), []);

  if (!Array.isArray(hands) || hands.length === 0) return null;

  return (
    <div style={containerStyle}>
      <svg ref={svgRef} style={svgStyle} width="100%" height="100%">
        {hands.map((hand, idx) => (
          <g key={`${hand?.label || 'hand'}-${idx}`}>
            {Array.isArray(hand.landmarks) && hand.landmarks.map((pt, i) => {
              const x = Number(pt?.[0]);
              const y = Number(pt?.[1]);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
              
              // 터치 UI 효과 테스트를 위해 모든 손가락에 터치 효과 적용
              // const active = true; // 강제로 터치 효과 활성화
              const active = isFingerActive(hand.label, i);

              return (
                <g key={`${idx}-${i}`}>
                  {active && (
                    <g className="hand-ray-ring">
                      <line x1={x} y1={y} x2={x+14} y2={y} stroke="rgba(52,211,153,0.9)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x-14} y2={y} stroke="rgba(52,211,153,0.9)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x} y2={y+14} stroke="rgba(52,211,153,0.9)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x} y2={y-14} stroke="rgba(52,211,153,0.9)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x+10} y2={y+10} stroke="rgba(52,211,153,0.8)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x-10} y2={y-10} stroke="rgba(52,211,153,0.8)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x-10} y2={y+10} stroke="rgba(52,211,153,0.8)" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x+10} y2={y-10} stroke="rgba(52,211,153,0.8)" strokeWidth="2" />
                    </g>
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 9 : 6}
                    fill={active ? 'rgba(34,197,94,1)' : (hand.fresh ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,0.4)')}
                    stroke={active ? '#34D399' : (hand.fresh ? '#10B981' : '#065F46')}
                    strokeWidth={active ? 3 : (hand.fresh ? 2 : 1)}
                    style={active ? { filter: 'drop-shadow(0 0 12px rgba(52,211,153,0.95))' } : undefined}
                  />
                </g>
              );})}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default HandsOverlay;


