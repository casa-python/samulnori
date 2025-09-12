import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import '../../styles/setting/ObjectSoundMappingComponent.css';
import SoundMappingModal from '../common/SoundMappingModal';
import useBackendStatus from '../../hooks/useBackendStatus';

const ObjectSoundMappingComponent = React.memo(({ 
  onBack, 
  selectedObjects, 
  objectIds,
  selectedObjectForMapping,
  setSelectedObjectForMapping, // 추가: 선택 해제용 setter
  onComplete,
  onSelectedObjectChange // 추가: ObjectOverlaySelected에 내려주는 콜백
}) => {
  // 전역 Storage에서 사물별 소리 매핑 관리
  const { setObjectSoundMapping, getObjectSoundMapping, setObjectFingerSoundMapping, getObjectFingerSoundMapping } = useObjectSelectionStore();
  // 스토어의 손가락 매핑/선택 키를 구독하여 변경 시 리렌더 유도
  const objectFingerSoundMapping = useObjectSelectionStore(state => state.objectFingerSoundMapping);
  const selectedKeys = useObjectSelectionStore(state => state.selectedObjectKeys);
  const { stopMediapipe } = useBackendStatus();

  // 모달 오픈 상태: selectedObjectForMapping이 있으면 true
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    setModalOpen(!!selectedObjectForMapping);
  }, [selectedObjectForMapping]);

  useEffect(() => {
    if (!selectedObjectForMapping && onSelectedObjectChange) {
      onSelectedObjectChange(null);
    }
  }, [selectedObjectForMapping, onSelectedObjectChange]);

  // 손가락 매핑 여부 판단 (store의 objectFingerSoundMapping 기준)
  const isFingerMapped = useCallback((trackId) => {
    const mapping = objectFingerSoundMapping?.[trackId] || { left: {}, right: {} };
    const hasAny = ['left', 'right'].some((hand) => {
      const handMap = mapping[hand] || {};
      return Object.values(handMap).some((val) => {
        if (!val) return false;
        if (typeof val === 'object') {
          return Boolean(val.id || val.name);
        }
        if (typeof val === 'string') {
          return val.length > 0;
        }
        return false;
      });
    });
    return hasAny;
  }, [objectFingerSoundMapping]);

  // 모달 저장 핸들러
  const handleModalSave = (trackId, hand, finger, soundType) => {
    setObjectFingerSoundMapping(trackId, hand, finger, soundType);
  };
  // 모달 닫기 핸들러
  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedObjectForMapping(null); // 선택된 사물 해제
    if (onSelectedObjectChange) {
      onSelectedObjectChange(null); // ObjectOverlaySelected의 내부 선택도 해제
    }
  };

  // 랜덤 소리 할당 함수 (기존 objectSoundMapping 용도 유지)
  const assignRandomSound = useCallback((trackId) => {
    const soundTypes = ['drum', 'cymbal', 'bell', 'gong'];
    const randomSound = soundTypes[Math.floor(Math.random() * soundTypes.length)];
    setObjectSoundMapping(trackId, randomSound);
  }, [setObjectSoundMapping]);

  // 소리 매핑이 없는 사물들에 랜덤 소리 할당 (초기 보조 용도)
  useEffect(() => {
    if (selectedObjects && selectedObjects.length > 0) {
      selectedObjects.forEach(object => {
        const currentSound = getObjectSoundMapping(object.trackId);
        if (!currentSound) {
          assignRandomSound(object.trackId);
        }
      });
    }
  }, [selectedObjects, getObjectSoundMapping, assignRandomSound]);

  const handleBackClick = useCallback(async () => {
    // 1. 선택 상태 초기화
    useObjectSelectionStore.getState().reset();
    // 2. API 호출
    try {
      const response = await fetch('http://localhost:8000/api/object/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(objectIds)
      });
      const result = await response.json();
    } catch (error) {
      console.error('사물 제거 API 호출 실패:', error);
    }
    // 3. 뒤로 이동
    onBack();
  }, [onBack, objectIds, stopMediapipe]);


  // 집계 값 계산: 선택 키 기준으로 항상 최신
  const totalCount = selectedKeys?.length || 0;
  const mappedCount = useMemo(() => (selectedKeys?.filter(id => isFingerMapped(id)).length || 0), [selectedKeys, isFingerMapped, objectFingerSoundMapping]);
  const unmappedCount = totalCount - mappedCount;


  return (
    <div className="object-sound-mapping-container">
      <div className="mapping-header">
        <button className="back-btn" onClick={handleBackClick}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 6 9 12 15 18" />
          </svg>
        </button>
        <h3 className="mapping-title">사물 소리 매핑</h3>
        <div className="mapping-status">
          <span className="status-badge">선택된 사물: {totalCount}개</span>
        </div>
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="mapping-content">
        <div className="mapping-instruction">
          <p>선택된 사물들에 소리를 매핑해주세요</p>
          <div style={{ textAlign: 'left' }}>
            <p className="mapping-hint" style={{ listStyle: 'none' }}>
              <strong>💡 카메라 화면에서 사물을 클릭</strong>하세요!
            </p>
            <p className="mapping-hint" style={{ listStyle: 'none' }}>
              💡 소리는 언제든지 변경할 수 있어요!
            </p>
          </div>
        </div>

        {/* 매핑 완료 현황 */}
        <div className="mapping-summary">
          {(totalCount > 0) ? (
            <div>
              <h4>매핑 완료 현황</h4>
              <div className="mapping-stats">
                <div className="stat-item">
                  <span className="stat-label">전체 사물:</span>
                  <span className="stat-value">{totalCount}개</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">소리 설정 완료:</span>
                  <span className={`stat-value ${mappedCount > 0 ? 'success' : ''}`}>{mappedCount}개</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">미설정:</span>
                  <span className={`stat-value ${unmappedCount > 0 ? 'warning' : ''}`}>{unmappedCount}개</span>
                </div>
              </div>
            </div>
          ) : (
            <h2 style={{ textAlign: 'center' }}>💡 사물을 다시 선택해주세요!</h2>
          )}
        </div>
      </div>

      {/* 고정된 버튼 영역 */}
      {totalCount > 0 ? (
        <div className="next-button-container">
          <button 
            className="next-btn"
            onClick={() => {
              const hasUnmapped = (selectedKeys || []).some(id => !isFingerMapped(id));
              if (hasUnmapped) {
                const proceed = window.confirm('아직 사운드가 설정되지 않은 사물이 있습니다. 넘어가시겠습니까?');
                if (!proceed) return;
              }
              if (onComplete) onComplete();
            }}
          >
            설정 완료
          </button>
        </div>
      ):(
        <div className="next-button-container">
          <button className="next-btn"onClick={handleBackClick}>
            사물 다시 설정하기
          </button>
        </div>
      )}

      {/* 사운드 매핑 모달 */}
      <SoundMappingModal
        open={modalOpen}
        onClose={handleModalClose}
        object={selectedObjectForMapping}
        onSave={handleModalSave}
        initialMapping={selectedObjectForMapping ? getObjectFingerSoundMapping(selectedObjectForMapping.trackId) : { left: {}, right: {} }}
      />
    </div>
  );
});

ObjectSoundMappingComponent.displayName = 'ObjectSoundMappingComponent';

export default ObjectSoundMappingComponent; 