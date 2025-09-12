import React, { useCallback, useEffect, useState } from 'react';
import useSettingStore from '../../stores/settingStore';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import useBackendStatus from '../../hooks/useBackendStatus';
import '../../styles/setting/CompleteSettingComponent.css';
import SoundMappingModal from '../common/SoundMappingModal';

function CompleteSettingComponent({ selectedObjectForMapping, setSelectedObjectForMapping }) {
  const { setCurrentView, reset: resetSetting } = useSettingStore();
  const { stopWebcam, stopStreaming, stopYolo, stopMediapipe, stopGlove } = useBackendStatus();
  const resetObjectStore = useObjectSelectionStore((s) => s.reset);
  const selectedObjectKeys = useObjectSelectionStore((s) => s.selectedObjectKeys);

  const [modalOpen, setModalOpen] = useState(false);
  const [treeData, setTreeData] = useState([]);

  // 선택된 사물 따라 모달 열기/닫기
  useEffect(() => {
    setModalOpen(!!selectedObjectForMapping);
  }, [selectedObjectForMapping]);

  // 사운드 트리 로드
  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/sample/tree');
        if (!res.ok) throw new Error('사운드 트리 API 오류');
        const data = await res.json();
        setTreeData(data);
      } catch (err) {
        console.error('사운드 트리 불러오기 실패:', err);
        setTreeData([]);
      }
    };
    fetchTree();
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedObjectForMapping(null);
  }, [setSelectedObjectForMapping]);

  const handleResetAll = useCallback(async () => {
    try {
      await stopStreaming();
      await stopYolo();
      await stopMediapipe();
      await stopGlove();
      await stopWebcam();
    } catch (e) {
      console.warn('백엔드 상태 초기화 중 오류:', e);
    }
    resetObjectStore();
    resetSetting();
    setCurrentView('initial');
  }, [stopStreaming, stopYolo, stopMediapipe, stopGlove, stopWebcam, resetObjectStore, resetSetting, setCurrentView]);

  const handleResetAllWithConfirm = useCallback(() => {
    const proceed = window.confirm('모든 사물과 사운드 설정이 초기화 됩니다. 계속하시겠습니까?');
    if (!proceed) return;
    handleResetAll();
  }, [handleResetAll]);

  const handleReconfigure = useCallback(() => {
    // 루프 아일랜드 숨기기
    if (window.hideLoopIsland) {
      window.hideLoopIsland();
    }
    // 저장된 상태는 유지하고 화면만 사물 선택 단계로 이동
    setCurrentView('selection');
  }, [setCurrentView]);

  const handleOpenLoopPlay = useCallback(() => {
    // 루프 아일랜드 표시
    if (window.showLoopIsland) {
      window.showLoopIsland();
    }
    // 루프 연주 설정 화면으로 이동
    setCurrentView('loop-play');
  }, [setCurrentView]);

  return (
    <div className="complete-setting-container">
      <div className="complete-header">
        <h3 className="complete-title">설정 완료</h3>
        <div className="complete-status">
          {selectedObjectKeys.length > 0 ? (
            <span className="status-badge-green">사용중인 사물: {selectedObjectKeys.length}개</span>
          ) : (
            <span className="status-badge-orange">사용중인 사물: 0개</span>
          )}
        </div>
      </div>
      <div className="complete-content">
        <div className="complete-message">
          <h1>
            모든 설정이 완료되었습니다.
            <br />
            <strong>SAMULNORI</strong>를 즐겨보세요!
          </h1>
          <p className="complete-hint">
            사물을 다시 클릭해서
            <br />
            사운드를 설정할 수 있습니다.
          </p>
        </div>
        <div className="reset-actions">
          <button className="reconfigure-btn" onClick={handleReconfigure}>사물 다시 설정하기</button>
          <button className="reset-btn" onClick={handleResetAllWithConfirm}>초기화 하기</button>
        </div>
      </div>
      <div className="loop-play-content">
        {selectedObjectKeys.length > 0 ? (
        <div className="complete-message" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                     <span>
             <strong>루프 연주</strong>를 해보세요!
             <br />
             <small style={{color: '#6B7280', fontWeight: 'normal'}}>클릭하면 루프 아일랜드가 나타납니다</small>
           </span>
           <button className="loop-play-btn" onClick={handleOpenLoopPlay}>루프 연주하기</button>
        </div>
        ) : (
          <div className="complete-message" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            <span>
              💡 <strong>사물을 다시 선택해주세요.</strong>
            </span>
          </div>
        )}
      </div>

      {/* 사운드 매핑 모달: 저장 시 useSoundMapping이 onClose를 호출하므로 자동 닫힘 */}
      <SoundMappingModal
        open={modalOpen}
        onClose={handleModalClose}
        object={selectedObjectForMapping}
        onSave={() => {}}
        initialMapping={selectedObjectForMapping ? useObjectSelectionStore.getState().getObjectFingerSoundMapping(selectedObjectForMapping.trackId) : { left: {}, right: {} }}
        treeData={treeData}
      />
    </div>
  );
}

export default CompleteSettingComponent;
