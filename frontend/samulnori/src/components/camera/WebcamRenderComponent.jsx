import React, { useEffect, useState } from 'react';

/**
 * WebcamRenderComponent
 * - 웹캠 화면, REC/STOP 버튼, 오버레이 포함 녹화 토글 UI만 담당
 * - webcamOn=false면 아무 것도 렌더링하지 않음(문구도 없음)
 */
function WebcamRenderComponent({
  webcamOn,
  streamStatus,
  isRecording,
  startRecording,
  stopRecording,
  recordOverlay,
  setRecordOverlay,
  canvasRef,
  elapsedMs,
  formatTime
}) {
  const [rendered, setRendered] = useState(false);
  const [phase, setPhase] = useState(''); // '', 'enter', 'exit'
  const SHOW_DELAY_MS = 2000; // 2초 지연

  useEffect(() => {
    let enterTimer = null;
    let exitTimer = null;
    let rafId = null;
    if (webcamOn) {
      // 대기 후 표시
      setPhase('exit');
      enterTimer = setTimeout(() => {
        setRendered(true);
        setPhase('exit');
        rafId = requestAnimationFrame(() => setPhase('enter'));
      }, SHOW_DELAY_MS);
    } else {
      // 즉시 exit 애니메이션 후 언마운트
      setPhase('exit');
      exitTimer = setTimeout(() => setRendered(false), 240);
    }
    return () => {
      if (enterTimer) clearTimeout(enterTimer);
      if (exitTimer) clearTimeout(exitTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [webcamOn]);

  if (!rendered) {
    if (!webcamOn) return null;
    return (
      <div className={`webcam-wrap pending`}>
        <div className="webcam-pending">
          <div className="webcam-pending-spinner" />
          <div className="webcam-pending-text">카메라를 로드하고 있습니다...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`webcam-wrap animating ${phase === 'enter' ? 'enter' : 'exit'}`}>
      {/* REC 버튼 */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
        {!isRecording ? (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <button
              onClick={startRecording}
              style={{
                background: '#e11d48',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700
              }}
              aria-label="녹화 시작"
            >
              ● REC
            </button>
            <label style={{
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.9rem'
            }}
            >
              <input type="checkbox" checked={recordOverlay} onChange={e => setRecordOverlay(e.target.checked)} />
              오버레이 포함
            </label>
          </div>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700
            }}
            aria-label="녹화 종료"
          >
            ■ STOP
          </button>
        )}
        {isRecording && (
          <div style={{
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: 8,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}
            aria-label="녹화 시간">
            {formatTime(elapsedMs)}
          </div>
        )}
      </div>

      {/* 웹캠 캔버스: 스트리밍 중일 때만 노출 (대기 화면은 상위 dots-area 배경에 의존) */}
      {streamStatus === 'streaming' ? (
        <canvas
          ref={canvasRef}
          className="webcam-video"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            imageRendering: 'optimizeSpeed',
            willChange: 'auto'
          }}
        />
      ) : null}
    </div>
  );
}

export default WebcamRenderComponent;


