import React, { useMemo, useEffect } from 'react';
import InitialSetupComponent from '../../components/setting/InitialSetupComponent';
import ObjectSelectionComponent from '../../components/setting/ObjectSelectionComponent';
import ObjectSoundMappingComponent from '../../components/setting/ObjectSoundMappingComponent';
import CompleteSettingComponent from '../../components/setting/CompleteSettingComponent';
import LoopPlaySettingComponent from '../../components/setting/LoopPlaySettingComponent';
import useCameraStore from '../../stores/cameraStore';
import useSettingStore from '../../stores/settingStore';
import '../../styles/setting/SettingRouter.css';

function SettingRouter({ 
  open, 
  onClose, 
  streamReady,
  selectedObjects,
  onObjectToggle,
  onViewChange,
  selectedObjectForMapping,
  setSelectedObjectForMapping
}) {
  // 전역 스토어로 상태 유지 (persist)
  const { currentView, setCurrentView, mappingData, setMappingData, reset } = useSettingStore();
  
  // 전역 스토어에서 결과 화면 상태 설정 함수 가져오기
  const { setResultView } = useCameraStore();

  const handleInitSuccess = () => {
    setCurrentView('selection');
    onViewChange && onViewChange('selection');
  };

  const handleBackToInitial = () => {
    setCurrentView('initial');
    onViewChange && onViewChange('initial');
    // 결과 화면 상태 해제
    setResultView(false, []);
  };

  const handleBackToSelection = () => {
    setCurrentView('selection');
    onViewChange && onViewChange('selection');
    // 결과 화면 상태 해제
    setResultView(false, []);
  };

  const handleBackToComplete = () => {
    setCurrentView('complete');
    onViewChange && onViewChange('complete');
  };

  const handleBackToLoopPlay = () => {
    setCurrentView('loop-play');
    onViewChange && onViewChange('loop-play');
  };

  // 사물 선택 완료 핸들러 (ObjectSelectionComponent → ObjectSoundMappingComponent)
  const handleObjectSelectionComplete = (selectedObjects, objectIds, apiResult) => {
    // 매핑 데이터 저장 (전역)
    setMappingData({ selectedObjects, objectIds, apiResult });
    // 매핑 화면으로 이동
    setCurrentView('mapping');
    onViewChange && onViewChange('mapping');
  };

  // 소리 매핑 완료 핸들러 (ObjectSoundMappingComponent → 완료)
  const handleMappingComplete = () => {
    // 전역 상태에 결과 화면 상태 설정 (혹시 외부에서 필요하면 유지)
    setResultView(true, mappingData.objectIds || []);
    // 완료 화면으로 이동
    setCurrentView('complete');
    onViewChange && onViewChange('complete');
  };

  // 패널을 닫을 때도 상태는 유지하되, 명시적으로 초기화가 필요하면 부모에서 reset을 호출하도록 함
  const handlePanelClose = () => {
    onClose();
  };

  // 전역 currentView 변경 시 상위(MainLayout)의 상태도 동기화
  useEffect(() => {
    if (onViewChange) {
      onViewChange(currentView);
    }
  }, [currentView, onViewChange]);

  return (
    <div className={`side-panel${open ? '' : ' side-panel--closed'}`}>
      <button className="side-toggle-btn left" onClick={handlePanelClose} aria-label="패널 닫기">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      
      {currentView === 'initial' ? (
        <InitialSetupComponent onInitSuccess={handleInitSuccess} />
      ) : currentView === 'selection' ? (
        <ObjectSelectionComponent
          onBack={handleBackToInitial}
          streamReady={streamReady}
          selectedObjects={selectedObjects}
          onObjectToggle={onObjectToggle}
          onNext={handleObjectSelectionComplete}
        />
      ) : currentView === 'mapping' ? (
        <ObjectSoundMappingComponent
          onBack={handleBackToSelection}
          selectedObjects={mappingData.selectedObjects}
          objectIds={mappingData.objectIds}
          apiResult={mappingData.apiResult}
          selectedObjectForMapping={selectedObjectForMapping}
          setSelectedObjectForMapping={setSelectedObjectForMapping}
          onSelectedObjectChange={setSelectedObjectForMapping}
          onComplete={handleMappingComplete}
        />
      ) : currentView === 'complete' ? (
        <CompleteSettingComponent
          selectedObjectForMapping={selectedObjectForMapping}
          setSelectedObjectForMapping={setSelectedObjectForMapping}
        />
      ) : currentView === 'loop-play' ? (
        <LoopPlaySettingComponent
          onBack={handleBackToComplete}
        />
      ) : (
        <div>
          <h2>설정이 완료되었습니다.</h2>
          <p>설정된 사물 목록:</p>
          <ul>
            {(mappingData.objectIds || []).map((id, index) => (
              <li key={index}>{id}</li>
            ))}
          </ul>
          <button onClick={handlePanelClose}>닫기</button>
        </div>
      )}
      <div className='side-logo-container'>
        <img src="./SAMULNORI_logo.png" alt="samulnori" className="side-logo" />
      </div>
    </div>
  );
}

export default SettingRouter;