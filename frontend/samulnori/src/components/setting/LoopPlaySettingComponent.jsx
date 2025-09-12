import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import useLoopStore from '../../stores/loopStore';
import { useWebSocketMessage } from '../../contexts/WebSocketContext';
import loopApi from '../../api/loop';
import '../../styles/setting/LoopPlaySettingComponent.css';

// 루프별 색상 팔레트
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

function LoopPlaySettingComponent({ onBack }) {
  const selectedObjectKeys = useObjectSelectionStore((s) => s.selectedObjectKeys);
  const {
    loops,
    selectedLoopId,
    transport,
    metronome,
    setTransport,
    setMetronome,
    addLoop,
    removeLoop,
    clearLoop,
    toggleLoopActiveLocal,
    selectLoopLocal,
    deselectLoopLocal,
    finalizeRecording,
    pendingSelectLoopId,
    setPendingSelectLoop,
    clearPendingSelect,
  } = useLoopStore();
  const [bpm, setBpm] = useState(transport.bpm);
  const [beatPerBar, setBeatPerBar] = useState(transport.beatPerBar);
  const [bars, setBars] = useState(transport.bars);
  const [creating, setCreating] = useState(false);
  const [creatingName, setCreatingName] = useState('Loop');

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

  const handleBack = useCallback(() => {
    // 루프 아일랜드 숨기기
    if (window.showLoopIsland) {
      window.hideLoopIsland();
    }
    if (onBack) onBack();
  }, [onBack]);

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
  }, [setTransport]);
  useWebSocketMessage('transport', handleTransportWs, [handleTransportWs]);

  const handleStartTransport = async () => {
    const clampedBpm = Math.max(30, Math.min(300, Number(bpm) || 120));
    const clampedBeat = Math.max(1, Math.min(16, Number(beatPerBar) || 4));
    const clampedBars = Math.max(1, Number(bars) || 1);
    setBpm(clampedBpm); setBeatPerBar(clampedBeat); setBars(clampedBars);
    await loopApi.startTransport({ bpm: clampedBpm, beatPerBar: clampedBeat, bars: clampedBars });
    setTransport({ bpm: clampedBpm, beatPerBar: clampedBeat, bars: clampedBars, playing: true });
  };

  const handleTogglePlay = async () => {
    const next = !transport.playing;
    await loopApi.toggleTransport({ playing: next });
    setTransport({ playing: next, phase: next ? transport.phase : 0 });
  };

  const handleCreateLoop = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await loopApi.createLoop({ name: creatingName || 'Loop' });
      const loopId = res?.data?.loop_id || res?.data?.id || res?.data;
      if (loopId) {
        // 새로운 루프 추가 (기존 이벤트는 유지됨)
        addLoop({ id: String(loopId), name: creatingName || 'Loop' });
        
        // 새로 생성된 루프를 자동으로 선택
        await requestSelect(String(loopId));
      }
    } catch (e) {
      console.error('루프 생성 실패', e);
    } finally {
      setCreating(false);
    }
  };

  const requestSelect = async (loopId) => {
    try {
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

  const handleDeleteLoop = async (id) => {
    try {
      await loopApi.deleteLoop({ id });
    } catch (e) {
      console.error('루프 삭제 API 실패', e);
    }
    removeLoop(id);
  };

  const handleClearLoop = async (id) => {
    try {
      await loopApi.clearLoop({ id });
    } catch (e) {
      console.error('루프 초기화 API 실패', e);
    }
    clearLoop(id);
  };

  const handleToggleActive = async (id, active) => {
    try {
      await loopApi.toggleLoopActive({ id, active });
      toggleLoopActiveLocal(id, active);
    } catch (e) {
      console.error('루프 활성/비활성 실패', e);
    }
  };

  const handleToggleMetronome = async () => {
    try {
      const enabled = !metronome.enabled;
      await loopApi.toggleMetronome({ enabled });
      setMetronome({ enabled });
    } catch (e) {
      console.error('메트로놈 토글 실패', e);
    }
  };

  // 키보드 테스트 이벤트 핸들러
  const handleKeyPress = useCallback(async (event) => {
    if (!transport.playing) return; // 재생 중일 때만 테스트 이벤트 추가
    
    // 이미 처리 중인 키는 무시
    if (event.repeat) return;
    
    // 선택된 루프가 없으면 무시
    if (!selectedLoopId) {
      console.log('선택된 루프가 없어서 테스트 이벤트를 추가할 수 없습니다.');
      return;
    }
    
    let objectId, label;
    switch (event.key.toLowerCase()) {
      case 'q':
        objectId = 'kick';
        label = '킥 드럼 (Q)';
        break;
      case 'w':
        objectId = 'piano';
        label = '피아노 (W)';
        break;
      default:
        return; // 다른 키는 무시
    }
    
    try {
      // 백엔드 API 호출
      await loopApi.addTestEvent({
        objectId,
        hand: 'right',
        finger: 'index',
        velocity: 1.0,
        label
      });
      
      // 프론트엔드에도 직접 이벤트 추가
      const keyboardEvent = {
        type: 'keyboard',
        key: event.key.toLowerCase(),
        objectId,
        tsMs: performance.now(),
        on: true
      };
      
      // 현재 선택된 루프에 키보드 이벤트 추가
      const currentLoop = loops.find(loop => loop.id === selectedLoopId);
      if (currentLoop) {
        const updatedEvents = [...(currentLoop.events || []), keyboardEvent];
        useLoopStore.getState().loops = useLoopStore.getState().loops.map(loop => 
          loop.id === selectedLoopId ? { ...loop, events: updatedEvents } : loop
        );
      }
      
      console.log(`테스트 이벤트 추가: ${label}`);
    } catch (e) {
      console.error('테스트 이벤트 추가 실패', e);
    }
  }, [transport.playing, selectedLoopId, loops]);

  // 키보드 이벤트 리스너 등록/해제
  useEffect(() => {
    if (transport.playing) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [handleKeyPress, transport.playing]);


  return (
    <div className="loop-play-container">
      <div className="loop-play-header">
        <button className="back-btn" onClick={handleBack} aria-label="이전">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 6 9 12 15 18" />
          </svg>
        </button>
        <h3 className="loop-play-title">플레이 세팅</h3>
        <div className="loop-play-status">
          {selectedObjectKeys.length > 0 ? (
            <span className="status-badge-green">사용중인 사물: {selectedObjectKeys.length}개</span>
          ) : (
            <span className="status-badge-orange">사용중인 사물: 0개</span>
          )}
        </div>
      </div>

      {/* Transport Controls */}
      <div className="transport-panel">
        <h4 className="section-title">루프 연주 설정</h4>
        
        {/* 설정 입력 영역 */}
        <div className="transport-settings">
          <div className="setting-group">
            <label className="setting-label">BPM</label>
            <input className="setting-input" type="number" min={30} max={300} value={bpm} onChange={(e) => setBpm(e.target.value)} />
          </div>
          <div className="setting-group">
            <label className="setting-label">Beat/Bar</label>
            <input className="setting-input" type="number" min={1} max={16} value={beatPerBar} onChange={(e) => setBeatPerBar(e.target.value)} />
          </div>
          <div className="setting-group">
            <label className="setting-label">Bars</label>
            <input className="setting-input" type="number" min={1} value={bars} onChange={(e) => setBars(e.target.value)} />
          </div>
        </div>

        {/* 컨트롤 버튼 영역 */}
        <div className="transport-controls">
          <div className="control-buttons">
            <button className="control-btn primary" onClick={handleStartTransport}>
              루프 시작
            </button>
            <button 
              className={`control-btn ${transport.playing ? 'stop' : 'play'}`} 
              onClick={handleTogglePlay}
            >
              {transport.playing ? '정지' : '재생'}
            </button>
          </div>
          
          <div className="metronome-section">
            <label className="metronome-toggle" onClick={handleToggleMetronome} title="메트로놈">
              <input 
                type="checkbox" 
                checked={metronome.enabled} 
                onChange={() => {}} 
                style={{ display: 'none' }} 
              />
              <div className={`toggle-switch ${metronome.enabled ? 'enabled' : 'disabled'}`}>
                <div className="toggle-slider"></div>
              </div>
              <span className="toggle-label">메트로놈</span>
            </label>
          </div>
        </div>

        {/* 루프 선택 경고 */}
        {transport.playing && !selectedLoopId && (
          <div className="loop-selection-warning">
            <span className="warning-text">
              ⚠️ 루프를 먼저 선택하세요!
            </span>
          </div>
        )}
      </div>

      {/* Loop Management */}
      <div className="loop-management-panel">
        <h4 className="section-title">루프 관리</h4>
        <div className="loop-list-header">
          <label id="loop-name-label">루프 이름</label>
          <input id="loop-name-input" value={creatingName} onChange={(e) => setCreatingName(e.target.value)} placeholder="루프 이름" />
          <button className="reconfigure-btn" onClick={handleCreateLoop} disabled={creating}>{creating ? '생성 중...' : '루프 생성'}</button>
        </div>
      
        <div className="loop-list">
          {loops.map(loop => {
            const loopColor = getLoopColor(loop.id);
            return (
              <div 
                key={loop.id} 
                className={`loop-item${selectedLoopId === loop.id ? ' selected' : ''}${!loop.active ? ' inactive' : ''}`} 
                onClick={() => handleLoopClick(loop.id)}
                style={{
                  '--loop-color': loopColor,
                  borderColor: selectedLoopId === loop.id ? loopColor : '#f3f4f6',
                  backgroundColor: selectedLoopId === loop.id ? `${loopColor}10` : '#ffffff'
                }}
              >
                <div className="loop-content">
                  <div className="loop-info">
                    <div className="loop-name">{loop.name}</div>
                                      <div className="loop-status">
                    <div className={`color-dot ${selectedLoopId === loop.id ? 'selected' : ''} ${loop.active ? 'active' : ''}`}></div>
                    <span className={`active-indicator ${loop.active ? 'active' : 'inactive'}`}>
                      {loop.active ? '활성' : '비활성'}
                    </span>
                  </div>
                  </div>
                  <div className="loop-actions">
                    <button 
                      className={`action-btn toggle-btn ${loop.active ? 'active' : 'inactive'}`} 
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(loop.id, !loop.active); }} 
                      title={loop.active ? '비활성화' : '활성화'}
                    >
                      {loop.active ? '🔊' : '🔇'}
                    </button>
                    <button 
                      className="action-btn reset-btn" 
                      onClick={(e) => { e.stopPropagation(); handleClearLoop(loop.id); }} 
                      title="초기화"
                    >
                      🔄
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={(e) => { e.stopPropagation(); handleDeleteLoop(loop.id); }} 
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {loops.length === 0 && (
            <div className="no-loops-message">
              <p>생성된 루프가 없습니다.</p>
              <p>위에서 루프를 생성해주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoopPlaySettingComponent;


