import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import useObjectSelectionStore from '../stores/objectSelectionStore';
import useLoopStore from '../stores/loopStore';
import { useWebSocketMessage } from '../contexts/WebSocketContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import '../styles/LoopIslandComponent.css';

// 루프별 색상 팔레트 (LoopPlaySettingComponent와 동일)
const LOOP_COLORS = [
  '#3B82F6', // 파란색
  '#EF4444', // 빨간색
  '#10B981', // 초록색
  '#F59E0B', // 주황색
  '#8B5CF6', // 보라색
  '#EC4899', // 분홍색
  '#06B6D4', // 청록색
  '#84CC16', // 연두색
  '#F97316', // 주황색
  '#6366F1', // 인디고
];

function LoopIslandComponent({ onExpandedChange }) {
  // WebSocket 연결 상태 확인
  const { connected } = useWebSocket();
  
  const selectedObjectKeys = useObjectSelectionStore((s) => s.selectedObjectKeys);
  const {
    loops,
    selectedLoopId,
    transport,
    setTransport,
    selectLoopLocal,
    deselectLoopLocal,
    handleIncomingEvent,
    finalizeRecording,
    pendingSelectLoopId,
    setPendingSelectLoop,
    clearPendingSelect,
  } = useLoopStore();
  
  const [isVisible, setIsVisible] = useState(false);
  const [recentEvents, setRecentEvents] = useState([]);

  // 루프 초기화/삭제 시 실시간 이벤트 제거
  useEffect(() => {
    // 루프가 삭제되거나 초기화되면 해당 루프의 실시간 이벤트 제거
    const currentLoopIds = loops.map(loop => loop.id);
    const clearedLoopIds = loops.filter(loop => !loop.events || loop.events.length === 0).map(loop => loop.id);
    
    setRecentEvents(prev => prev.filter(event => 
      currentLoopIds.includes(event.loopId) && !clearedLoopIds.includes(event.loopId)
    ));
  }, [loops]);

  // 루프별 색상 할당 함수 (ID 기반 해시)
  const getLoopColor = useCallback((loopId) => {
    // 루프 ID를 기반으로 한 간단한 해시 함수
    let hash = 0;
    for (let i = 0; i < loopId.length; i++) {
      const char = loopId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    const index = Math.abs(hash) % LOOP_COLORS.length;
    return LOOP_COLORS[index];
  }, []);

  // WS: transport 업데이트 (phase/playing 등) - 안정적인 핸들러
  const handleTransportWs = useCallback((payload) => {
    const { phase, playing, bpm: nbpm, beatPerBar: nbpb, bars: nbars } = payload || {};
    const prev = useLoopStore.getState().transport;
    setTransport({
      phase: typeof phase === 'number' ? phase : prev.phase,
      playing: typeof playing === 'boolean' ? playing : prev.playing,
      bpm: typeof nbpm === 'number' ? nbpm : prev.bpm,
      beatPerBar: typeof nbpb === 'number' ? nbpb : prev.beatPerBar,
      bars: typeof nbars === 'number' ? nbars : prev.bars,
    });
    if (typeof phase === 'number') setUiPhase(phase);
    if (typeof playing === 'boolean') {
      if (playing) startLocalAnimation(); else stopLocalAnimation(true);
    }
  }, [setTransport]);
  useWebSocketMessage('transport', handleTransportWs, [handleTransportWs]);

  // UI용 로컬 페이즈 및 애니메이션
  const [uiPhase, setUiPhase] = useState(transport.phase || 0);
  const rafRef = useRef(null);
  const startTsRef = useRef(0);
  const durationMsRef = useRef(0);

  const computeDurationMs = useCallback((bpmVal, bpbVal, barsVal) => {
    const beats = Math.max(1, Number(bpbVal) || 4) * Math.max(1, Number(barsVal) || 1);
    const spb = 60 / Math.max(1, Number(bpmVal) || 120);
    return beats * spb * 1000;
  }, []);

  // WS: 이벤트(on) 수신 시 기록 - 안정적인 핸들러
  const handleEventWs = useCallback((payload) => {
    if (!payload) return;
    const { on, objectId, hand, finger, tsMs } = payload;
    useLoopStore.getState().handleIncomingEvent({ on, objectId, hand, finger, tsMs });
    
    // 실시간 이벤트 선을 위한 상태 업데이트 (키보드 이벤트와 동일한 로직)
    if (on && objectId && tsMs) {
      const now = Date.now();
      const duration = durationMsRef.current || computeDurationMs(transport.bpm, transport.beatPerBar, transport.bars);
      const eventPosition = (tsMs / duration) * 100;
      
      // 선택된 루프가 있고, 해당 객체가 선택된 객체인지 확인
      if (selectedLoopId) {
        const selectedLoop = loops.find(loop => loop.id === selectedLoopId);
        if (selectedLoop) {
          const loopColor = getLoopColor(selectedLoopId);
          const newEvent = {
            id: `recent-${now}`,
            loopId: selectedLoopId,
            loopName: selectedLoop.name,
            color: loopColor,
            position: Math.min(100, Math.max(0, eventPosition)),
            timestamp: now,
            objectId: objectId,
            hand: hand,
            finger: finger
          };
          
          setRecentEvents(prev => [...prev, newEvent]);
        }
      }
    }
  }, [transport.bpm, transport.beatPerBar, transport.bars, selectedLoopId, loops, getLoopColor, computeDurationMs]);
  useWebSocketMessage('event', handleEventWs, [handleEventWs]);

  // 키보드 이벤트 처리 (테스트용)
  const handleKeyboardEvent = useCallback((event) => {
    if (!transport.playing || !selectedLoopId) return;
    
    const key = event.key.toLowerCase();
    if (key !== 'q' && key !== 'w') return; // Q(킥), W(피아노)만 처리
    
    const now = Date.now();
    const duration = durationMsRef.current || computeDurationMs(transport.bpm, transport.beatPerBar, transport.bars);
    const startTime = now - (uiPhase * duration);
    const eventTime = startTime + (uiPhase * duration);
    
    // 선택된 루프에 키보드 이벤트 추가
    const keyboardEvent = {
      id: `keyboard-${now}`,
      type: 'keyboard',
      key: key,
      tsMs: eventTime,
      on: true,
      objectId: key === 'q' ? 'kick' : 'piano'
    };
    
    useLoopStore.getState().handleIncomingEvent(keyboardEvent);
    
    // 실시간 이벤트 선을 위한 상태 업데이트
    const selectedLoop = loops.find(loop => loop.id === selectedLoopId);
    if (selectedLoop) {
      const loopColor = getLoopColor(selectedLoopId);
      const newEvent = {
        id: `recent-${now}`,
        loopId: selectedLoopId,
        loopName: selectedLoop.name,
        color: loopColor,
        position: uiPhase * 100,
        timestamp: now,
        key: key
      };
      
      setRecentEvents(prev => [...prev, newEvent]);
    }
  }, [transport.playing, selectedLoopId, uiPhase, computeDurationMs, transport.bpm, transport.beatPerBar, transport.bars, loops, getLoopColor]);

  // 키보드 이벤트 처리 (테스트용)
  useEffect(() => {
    if (transport.playing && selectedLoopId) {
      document.addEventListener('keydown', handleKeyboardEvent);
      return () => document.removeEventListener('keydown', handleKeyboardEvent);
    }
  }, [transport.playing, selectedLoopId, handleKeyboardEvent]);


  useEffect(() => {
    durationMsRef.current = computeDurationMs(transport.bpm, transport.beatPerBar, transport.bars);
  }, [transport.bpm, transport.beatPerBar, transport.bars, computeDurationMs]);

  const startLocalAnimation = useCallback(() => {
    const duration = durationMsRef.current || computeDurationMs(transport.bpm, transport.beatPerBar, transport.bars);
    startTsRef.current = performance.now() - (uiPhase * duration);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const now = performance.now();
      const elapsed = (now - startTsRef.current) % (duration || 1);
      const phase = Math.max(0, Math.min(1, elapsed / (duration || 1)));
      setUiPhase(phase);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [computeDurationMs, transport.bpm, transport.beatPerBar, transport.bars]);

  const stopLocalAnimation = useCallback((resetToZero = true) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (resetToZero) setUiPhase(0);
  }, []);

  useEffect(() => {
    setUiPhase(typeof transport.phase === 'number' ? transport.phase : 0);
  }, [transport.phase]);

  // transport.playing 상태에 따라 애니메이션 시작/정지
  useEffect(() => {
    if (transport.playing) {
      startLocalAnimation();
    } else {
      stopLocalAnimation(true);
    }
  }, [transport.playing, startLocalAnimation, stopLocalAnimation]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const progressPercent = useMemo(() => `${Math.round((uiPhase || 0) * 100)}%`, [uiPhase]);

  const totalBeats = useMemo(() => {
    const bpb = Math.max(1, Number(transport.beatPerBar) || 4);
    const brs = Math.max(1, Number(transport.bars) || 1);
    return bpb * brs;
  }, [transport.beatPerBar, transport.bars]);
  const beatIndexes = useMemo(() => Array.from({ length: totalBeats + 1 }, (_, i) => i), [totalBeats]);

  const requestSelect = async (loopId) => {
    try {
      const { default: loopApi } = await import('../api/loop');
      await loopApi.selectLoop({ id: loopId });
      selectLoopLocal(loopId);
    } catch (e) {
      console.error('루프 선택 실패', e);
    }
  };

  const handleLoopClick = async (loopId) => {
    if (selectedLoopId === loopId) {
      // Deselect
      try {
        const { default: loopApi } = await import('../api/loop');
        await loopApi.deselectLoop();
      } catch (e) {
        console.error('루프 해제 실패', e);
      }
      finalizeRecording();
      deselectLoopLocal();
      return;
    }
    // Select logic: phase가 0 근처일 때만 즉시, 아니면 페이즈가 0이 될 때까지 대기
    const nearZero = (transport.phase || 0) < 0.02;
    if (nearZero) {
      await requestSelect(loopId);
    } else {
      setPendingSelectLoop(loopId);
    }
  };

  // 보류된 선택 요청 처리: phase가 0으로 돌아오면 수행
  const handlePendingSelectWs = useCallback((payload) => {
    const loopId = useLoopStore.getState().pendingSelectLoopId;
    if (!loopId) return;
    const p = typeof payload?.phase === 'number' ? payload.phase : 1;
    if (p < 0.02) {
      clearPendingSelect();
      requestSelect(loopId);
    }
  }, [clearPendingSelect]);
  useWebSocketMessage('transport', handlePendingSelectWs, [handlePendingSelectWs]);

  // 아일랜드를 표시하는 함수 (전역에서 접근 가능)
  const showIsland = () => {
    setIsVisible(true);
  };

  // 아일랜드를 숨기는 함수 (전역에서 접근 가능)
  const hideIsland = () => {
    setIsVisible(false);
  };

  // 전역에서 접근할 수 있도록 window 객체에 등록
  useEffect(() => {
    window.showLoopIsland = showIsland;
    window.hideLoopIsland = hideIsland;
    return () => {
      delete window.showLoopIsland;
      delete window.hideLoopIsland;
    };
  }, []);



  // 백엔드 연결이 안 되거나 아일랜드가 숨겨져 있으면 아일랜드 숨김
  if (!connected || !isVisible) {
    return null;
  }

  return (
    <div className="loop-island">
      {/* 루프 범례 */}
      <div className="loop-legend">
        {loops.map(loop => (
          <div key={loop.id} className={`legend-item ${!loop.active ? 'inactive' : ''}`}>
            <div 
              className="legend-color-dot" 
              style={{ 
                backgroundColor: loop.active ? getLoopColor(loop.id) : '#6B7280',
                opacity: loop.active ? 1 : 0.4
              }}
            ></div>
            <span className="legend-name">{loop.name}</span>
          </div>
        ))}
      </div>

      {/* 타임라인 룰러 */}
      <div className="timeline-ruler">
        {/* 눈금선 */}
        <div className="timeline-grid">
          {beatIndexes.map((i) => (
            <div
              key={i}
              className={`tick ${i % (transport.beatPerBar || 4) === 0 ? 'major' : 'minor'}`}
              style={{ left: `${(i / (totalBeats || 1)) * 100}%` }}
            />
          ))}
        </div>
        {/* 바 번호 라벨 */}
        <div className="ruler-labels">
          {Array.from({ length: Math.max(1, Number(transport.bars) || 1) }, (_, idx) => (
            <div key={idx} className="ruler-label" style={{ left: `${(idx / (Math.max(1, Number(transport.bars) || 1))) * 100}%` }}>
              {idx + 1}
            </div>
          ))}
        </div>
        {/* 플레이헤드 */}
        <div className="playhead" style={{ left: progressPercent }} />
      </div>

      {/* 이벤트 트랙 */}
      <div className="track-events">
          {/* 모든 루프의 이벤트를 하나의 타임라인에 표시 */}
          {loops.flatMap(loop => {
            const loopColor = getLoopColor(loop.id);
            const loopEvents = loop.events || [];
            
            return loopEvents.map((event, eventIndex) => {
              // 이벤트 위치 계산: tsMs가 있으면 사용, 없으면 timing을 사용
              let eventPosition;
              if (event.tsMs !== undefined) {
                // tsMs가 있는 경우 (실시간 이벤트)
                eventPosition = (event.tsMs / (durationMsRef.current || 1)) * 100;
              } else if (event.timing !== undefined) {
                // timing이 있는 경우 (저장된 이벤트)
                eventPosition = event.timing * 100;
              } else {
                eventPosition = 0;
              }
              
              const isActive = loop.active;
              
              // 비활성 루프의 이벤트는 회색 + 투명도 적용
              const eventColor = isActive ? loopColor : '#6B7280';
              
              return (
                <div
                  key={`${loop.id}-${eventIndex}`}
                  className={`timeline-event ${!isActive ? 'inactive' : ''}`}
                  style={{
                    left: `${Math.min(100, Math.max(0, eventPosition))}%`,
                    backgroundColor: eventColor,
                    borderColor: eventColor,
                    opacity: isActive ? 1 : 0.4
                  }}
                  title={`${loop.name} - ${event.on ? 'ON' : 'OFF'} (${event.objectId})`}
                />
              );
            });
          })}
          
          {/* 실시간 이벤트 선 */}
          {recentEvents.map(event => {
            const loop = loops.find(l => l.id === event.loopId);
            const isActive = loop?.active ?? true;
            const lineColor = isActive ? event.color : '#6B7280';
            
            // 이벤트 타입에 따른 title 생성
            let eventTitle;
            if (event.key) {
              // 키보드 이벤트
              eventTitle = `${event.loopName} - 키보드(${event.key.toUpperCase()})`;
            } else if (event.objectId) {
              // WebSocket 터치 이벤트
              eventTitle = `${event.loopName} - 터치(${event.objectId}) ${event.hand ? `- ${event.hand}손` : ''} ${event.finger !== undefined ? `- ${event.finger}번` : ''}`;
            } else {
              eventTitle = `${event.loopName} - 이벤트`;
            }
            
            return (
              <div
                key={event.id}
                className={`realtime-event-line ${!isActive ? 'inactive' : ''}`}
                style={{
                  left: `${Math.min(100, Math.max(0, event.position))}%`,
                  backgroundColor: lineColor,
                  borderColor: lineColor,
                  opacity: isActive ? 1 : 0.4
                }}
                title={`${eventTitle} ${!isActive ? '(비활성)' : ''}`}
              />
            );
          })}
        </div>
    </div>
  );
}

export default LoopIslandComponent;
