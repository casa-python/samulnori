import React, { useState, useEffect, useCallback } from 'react';
import useBackendStatus from '../../hooks/useBackendStatus';
import useObjectDetection from '../../hooks/useObjectDetection';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import '../../styles/setting/ObjectSelectionComponent.css';

const ObjectSelectionComponent = React.memo(({ onBack, streamReady, selectedObjects, onObjectToggle, onNext }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [yoloActivated, setYoloActivated] = useState(false);
  
  const { yoloOn, gloveOn, startYolo, startMediapipe, startGlove, isConnected } = useBackendStatus();
  const { objects } = useObjectDetection();
  
  // 전역 Storage에서 선택된 사물 key 값들 관리
  const { selectedObjectKeys, toggleSelectedObjectKey } = useObjectSelectionStore();
  
  // 컴포넌트 마운트 시 자동으로 YOLO 활성화
  useEffect(() => {
    const activateYolo = async () => {
      console.log('=== YOLO 활성화 시도 ===');
      console.log('백엔드 연결 상태:', isConnected);
      console.log('yoloActivated:', yoloActivated);
      console.log('yoloOn:', yoloOn);
      
      if (!isConnected) {
        console.error('백엔드에 연결되지 않아 YOLO를 활성화할 수 없습니다.');
        return;
      }
      
      if (!yoloActivated && !yoloOn) {
        try {
          console.log('ObjectSelectionComponent: 자동으로 yolo_on=true 설정 시작');
          await startYolo();
          setYoloActivated(true);
          console.log('ObjectSelectionComponent: YOLO 활성화 요청 완료');
        } catch (error) {
          console.error('ObjectSelectionComponent: YOLO 활성화 실패:', error);
        }
      } else {
        console.log('YOLO가 이미 활성화되어 있거나 활성화 중입니다.');
      }

      // 글러브 자동 활성화(백엔드가 필드 제공)
      try {
        if (!gloveOn) {
          console.log('ObjectSelectionComponent: 자동으로 glove_on=true 설정 시작');
          await startGlove();
          console.log('ObjectSelectionComponent: 글러브 활성화 요청 완료');
        }
      } catch (error) {
        console.error('ObjectSelectionComponent: 글러브 활성화 실패:', error);
      }
    };
    
    activateYolo();
  }, [startYolo, startGlove, yoloOn, gloveOn, yoloActivated, isConnected]);

  const handleBackClick = useCallback(async () => {
    // 1. 선택 상태 초기화
    useObjectSelectionStore.getState().reset();
    // 2. API 호출
    try {
      const response = await fetch('http://localhost:8000/api/object/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedObjectKeys)
      });
      const result = await response.json();
      console.log('사물 제거 API 응답:', result);
    } catch (error) {
      console.error('사물 제거 API 호출 실패:', error);
    }
    // 3. 뒤로 이동
    onBack();
  }, [onBack, selectedObjectKeys]);

  // 다음 버튼 클릭 핸들러
  const handleNextClick = useCallback(async () => {
    if (selectedObjectKeys && selectedObjectKeys.length > 0) {
      try {
        console.log('선택된 사물들의 trackId:', selectedObjectKeys);
        
        // API 호출
        const apiResult = await sendSelectedObjectsToAPI(selectedObjectKeys);
        console.log('API 호출 결과:', apiResult);
        
        // ObjectSoundMappingComponent로 이동
        if (onNext) {
          // selectedObjects는 실제 객체 정보가 필요하므로 필터링
          const filteredSelectedObjects = objects.filter(obj => selectedObjectKeys.includes(obj.trackId));
          onNext(filteredSelectedObjects, selectedObjectKeys, apiResult);
        }
        
      } catch (error) {
        console.error('다음 단계 이동 실패:', error);
        alert('사물 선택에 실패했습니다. 다시 시도해주세요.');
      }
    } else {
      alert('사물을 하나 이상 선택해주세요.');
    }
  }, [selectedObjectKeys, objects, onNext]);


  // 선택된 사물 제거 핸들러 - 성능 최적화
  const handleRemoveObject = useCallback((object) => {
    console.log('사물 제거 시도:', object);
    // 전역 Storage에서도 제거
    toggleSelectedObjectKey(object.trackId);
    if (onObjectToggle) {
      // 즉시 실행되도록 Promise.resolve().then() 사용
      Promise.resolve().then(() => {
        onObjectToggle(object);
        console.log('사물 제거 완료:', object);
      });
    }
  }, [onObjectToggle, toggleSelectedObjectKey]);

  
  // 사물 선택 API 호출 함수
  const sendSelectedObjectsToAPI = async (objectIds) => {
    try {
      console.log('사물 선택 API 호출:', objectIds);
      
      const response = await fetch('http://localhost:8000/api/object/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(objectIds)
      });

      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`);
      }

      const result = await response.json();
      console.log('사물 선택 API 응답:', result);
      
      return result;
    } catch (error) {
      console.error('사물 선택 API 호출 실패:', error);
      throw error;
    }
  };

  // 선택된 사물 목록 렌더링 최적화
  const renderSelectedObjects = useCallback(() => {
    if (!selectedObjectKeys || selectedObjectKeys.length === 0) {
      return (
        <div className="no-selected-objects">
          <p>아직 선택된 사물이 없습니다.</p>
          <p>화면에서 사물을 클릭해주세요.</p>
        </div>
      );
    }

    // 선택된 key에 해당하는 객체들만 필터링
    const filteredObjects = objects.filter(obj => selectedObjectKeys.includes(obj.trackId));

    return (
      <div className="selected-objects-section">
        <h4 className="selected-title">선택된 사물 목록 ({filteredObjects.length}개)</h4>
        <div className="selected-objects-list">
          {filteredObjects.map((object, index) => {
            // class_name_trackId 형식으로 표시
            const displayName = `${object.class_name}_${object.trackId}`;
            
            return (
              <div key={`${object.trackId}-${object.class_name}-${index}`} className="selected-object-item">
                <span className="selected-object-name">
                  {displayName} ({(object.confidence * 100).toFixed(1)}%)
                </span>
                <button 
                  className="remove-object-btn"
                  onClick={() => handleRemoveObject(object)}
                  title="선택 해제"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [selectedObjectKeys, objects, handleRemoveObject]);

  return (
    <div className="object-selection-container">
      <div className="selection-header">
        <button className="back-btn" onClick={handleBackClick}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 6 9 12 15 18" />
          </svg>
        </button>
        <h3 className="selection-title">사물 선택</h3>
        <div className="yolo-status-container">
          {yoloOn ? (
            <span className="yolo-status success">🟢 YOLO 활성화됨</span>
          ) : (
            <span className="yolo-status warning">🟡 YOLO 비활성화</span>
          )}
        </div>
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="selection-content">
        {!streamReady ? (
          <div className="stream-waiting">
            <div className="loading-spinner"></div>
            <p>스트림 준비 중...</p>
          </div>
        ) : (
          <>
            <div className="selection-instruction">
              <p>화면에서 사물을 클릭하여 선택해주세요</p>
              <p className="selection-hint">여러 사물을 선택할 수 있습니다.</p>
            </div>

            {/* 선택된 사물 목록 */}
            {renderSelectedObjects()}

            {isSelecting && (
              <div className="selection-result">
                <div className="selecting-indicator">
                  <span className="pulse-dot"></span>
                  인식 중...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 고정된 버튼 영역 */}
      <div className="next-button-container">
        <button 
          className="next-btn"
          onClick={() => {
            handleNextClick();
            startMediapipe();
            setMediapipeActivated(true);
          }}
          disabled={!selectedObjectKeys || selectedObjectKeys.length === 0}
        >
          다음
        </button>
      </div>
    </div>
  );
});

// 디스플레이 이름 설정
ObjectSelectionComponent.displayName = 'ObjectSelectionComponent';

export default ObjectSelectionComponent; 