import React, { useState, useEffect } from 'react';
import useBackendStatus from '../../hooks/useBackendStatus';
import '../../styles/setting/InitialSetupComponent.css';

/**
 * 초기 설정 컴포넌트 - ObjectSelectionComponent와 유사한 레이아웃
 */
function InitialSetupComponent({ onInitSuccess }) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMovingToNext, setIsMovingToNext] = useState(false);
  
  const {
    isConnected,
    error,
    status,
    webcamOn,
    streaming,
    running,
    startWebcam,
    startStreaming,
    retryConnection,
  } = useBackendStatus();

  // 초기화 완료 여부 확인
  const isInitialized = webcamOn && streaming;

  const handleInitialize = async () => {
    if (!isConnected) {
      alert('백엔드 서버에 연결되지 않았습니다.');
      return;
    }
    setIsInitializing(true);
    try {
      await startWebcam();
      await startStreaming();
    } catch (error) {
      console.error('초기 설정 실패:', error);
      alert('초기 설정에 실패했습니다.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleNextStep = async () => {
    if (!isInitialized) {
      alert('먼저 초기 설정을 완료해주세요.');
      return;
    }
    setIsMovingToNext(true);
    try {
      if (onInitSuccess) onInitSuccess();
    } catch (error) {
      console.error('다음 단계 이동 실패:', error);
      alert('다음 단계로 이동하는데 실패했습니다.');
    } finally {
      setIsMovingToNext(false);
    }
  };

  return (
    <div className="initial-setup-container">
      {/* 헤더 */}
      <div className="setup-header">
        <h3 className="setup-title">시스템 초기 설정</h3>
        <div className="connection-status-container">
          <span className={`connection-status ${isConnected ? 'success' : 'warning'}`}>
            {isConnected ? '🟢 API 연결됨' : '🟡 API 연결 대기'}
          </span>
        </div>
      </div>

      {/* 스크롤 가능한 콘텐츠 */}
      <div className="setup-content">
        {/* 상태 섹션 */}
        <div className="status-display">
          <h4>시스템 상태</h4>
          <div className="status-grid">
            <div className={`status-item ${isConnected ? 'success' : 'fail'}`}>
              <span className="status-label">API 연결</span>
              <span className="status-value">{isConnected ? '✅' : '❌'}</span>
            </div>
            <div className={`status-item ${running ? 'success' : 'fail'}`}>
              <span className="status-label">시스템</span>
              <span className="status-value">{running ? '✅' : '❌'}</span>
            </div>
            <div className={`status-item ${webcamOn ? 'success' : 'fail'}`}>
              <span className="status-label">웹캠</span>
              <span className="status-value">{webcamOn ? '✅' : '❌'}</span>
            </div>
            <div className={`status-item ${streaming ? 'success' : 'fail'}`}>
              <span className="status-label">스트리밍</span>
              <span className="status-value">{streaming ? '✅' : '❌'}</span>
            </div>
          </div>
          {error && <div className="error-message">⚠️ {error}</div>}
        </div>

        {/* 안내 섹션 */}
        <div className="setup-instruction">
          {!isConnected ? (
            <>
              <p className="setup-message">백엔드 서버에 연결할 수 없습니다. 재시도해주세요.</p>
              <button className="retry-btn" onClick={retryConnection}>연결 재시도</button>
            </>
          ) : isInitialized ? (
            <>
              <p className="success-message">✅ 초기 설정이 완료되었습니다!</p>
              <p>웹캠과 스트리밍이 활성화되었습니다.
                <br />
                상태를 확인한 후 다음으로 진행하세요.
              </p>
            </>
          ) : (
            <>
              <p className="setup-message">카메라 스트리밍을 시작하려면 초기 설정을 진행해주세요.</p>
            </>
          )}
        </div>
      </div>

      {/* 하단 고정 버튼 영역 */}
      <div className="next-button-container">
        {!isInitialized ? (
          <button 
            className="setup-btn"
            onClick={handleInitialize}
            disabled={isInitializing || !isConnected}
          >
            {isInitializing ? '설정 중...' : '초기 설정'}
          </button>
        ) : (
          <button 
            className="setup-btn"
            onClick={handleNextStep}
            disabled={isMovingToNext}
          >
            {isMovingToNext ? '이동 중...' : '다음 단계로 진행 (사물 선택)'}
          </button>
        )}
      </div>
    </div>
  );
}

export default InitialSetupComponent; 