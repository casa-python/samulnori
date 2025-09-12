import React, { useEffect, useRef, useCallback, useState } from 'react';
import useCameraStore from '../../stores/cameraStore';
import useObjectSelectionStore from '../../stores/objectSelectionStore';
import { useWebSocketMessage } from '../../contexts/WebSocketContext';
import useCameraStream from '../../hooks/useCameraStream';
import useBackendStatus from '../../hooks/useBackendStatus';
import ObjectOverlayAll from './ObjectOverlayAll';
import ObjectOverlaySelected from './ObjectOverlaySelected';
import HandsOverlay from './HandsOverlay';
import WebcamRenderComponent from './WebcamRenderComponent';
import Swal from 'sweetalert2';
import '../../styles/camera/CameraComponent.css';

function CameraComponent({ settingOpen, onOpen, currentSettingView, onSelectedObjectChange, selectedObjectForMapping, onRequestUpload, loopIslandComponent }) {
  const [loopIslandExpanded, setLoopIslandExpanded] = useState(false);
  const canvasRef = useRef(null);
  const overlaySvgRef = useRef(null);
  const compositeCleanupRef = useRef(null);
  // 오버레이 래스터 캐시
  const overlayImgRef = useRef(null);
  const overlayUrlRef = useRef(null);
  const overlayDirtyRef = useRef(true);
  const overlayLoadingRef = useRef(false);
  const overlayReadyRef = useRef(false);
  const overlayObserverRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef(null);
  const recordStartRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const navigatingRef = useRef(false);
  // ffmpeg 변환은 메인 프로세스에서 처리 (ffmpeg-static)
  const {
    streamStatus,
    imageError,
    selectedObjects,
    toggleSelectedObject
  } = useCameraStore();

  // 백엔드 상태 확인
  const { webcamOn, mediapipeOn } = useBackendStatus();

  // 전역 Storage에서 선택된 사물 key 값들 관리
  const { toggleSelectedObjectKey } = useObjectSelectionStore();

  // 카메라 스트림 처리
  const { handleFrameMessage, cleanup } = useCameraStream();

  // 사물 클릭 핸들러 - 전역 Storage와 기존 스토어 모두 업데이트
  const handleObjectClick = useCallback((object, index) => {
    // 기존 cameraStore 업데이트
    toggleSelectedObject(object);

    // 전역 Storage에도 업데이트
    toggleSelectedObjectKey(object.trackId);
  }, [toggleSelectedObject, toggleSelectedObjectKey]);

  // ObjectOverlaySelected에서 선택된 사물 변경 시 호출되는 핸들러
  const handleSelectedObjectChange = useCallback((selectedObject) => {
    if (onSelectedObjectChange) {
      onSelectedObjectChange(selectedObject);
    }
  }, [onSelectedObjectChange]);

  // WebSocket 메시지 핸들러 등록 (frame 타입)
  useWebSocketMessage('frame', handleFrameMessage, [handleFrameMessage]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 녹화 중이면 정지하고 정리
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_) { }
      }
      cleanup();
    };
  }, [cleanup]);

  const ArrowIcon = (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18" /></svg>
  );

  const showSelectedOverlay = currentSettingView === 'mapping' || currentSettingView === 'complete' || currentSettingView === 'loop-play';
  const isInitialSetup = currentSettingView === 'initial';
  const isSelectionView = currentSettingView === 'selection';

  // 녹화 시 오버레이 포함 여부 토글
  const [recordOverlay, setRecordOverlay] = useState(false);

  // 녹화 종료 (다른 훅에서 사용하므로 먼저 선언)
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    try { mediaRecorderRef.current.stop(); } catch (e) { console.error(e); }
    mediaRecorderRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(0);
    setIsRecording(false);
  }, []);

  // webcamOn이 꺼지면 녹화 자동 종료
  useEffect(() => {
    if (!webcamOn && isRecording) {
      stopRecording();
    }
  }, [webcamOn, isRecording, stopRecording]);

  // 녹화 시작
  const startRecording = useCallback(() => {
    if (!canvasRef.current || isRecording) return;

    // 오버레이 포함 옵션이면 오키드 캔버스에 비디오 + 오버레이를 합성하여 사용
    let renderCanvas = canvasRef.current;
    let cleanupComposite = null;
    if (recordOverlay) {
      const srcCanvas = canvasRef.current;
      const svgEl = overlaySvgRef.current;
      if (srcCanvas && svgEl) {
        const composite = document.createElement('canvas');
        composite.width = srcCanvas.width;
        composite.height = srcCanvas.height;
        const cctx = composite.getContext('2d');
        let raf;
        // 오버레이 비트맵 갱신 (변경 시에만)
        const ensureOverlayUpdated = () => {
          if (overlayLoadingRef.current || !svgEl) return;
          if (!overlayDirtyRef.current) return;
          try {
            const svgData = new XMLSerializer().serializeToString(svgEl);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            overlayLoadingRef.current = true;
            const img = overlayImgRef.current || new Image();
            overlayImgRef.current = img;
            img.onload = () => {
              overlayReadyRef.current = true;
              overlayLoadingRef.current = false;
              overlayDirtyRef.current = false;
              // 이전 URL 정리
              if (overlayUrlRef.current) URL.revokeObjectURL(overlayUrlRef.current);
              overlayUrlRef.current = url;
            };
            img.onerror = () => {
              overlayLoadingRef.current = false;
              URL.revokeObjectURL(url);
            };
            img.src = url;
          } catch (_) {
            overlayLoadingRef.current = false;
          }
        };

        // 변경 감지로 dirty 플래그 설정
        try {
          overlayObserverRef.current = new MutationObserver(() => {
            overlayDirtyRef.current = true;
          });
          overlayObserverRef.current.observe(svgEl, { attributes: true, childList: true, subtree: true });
        } catch (_) { }

        const draw = () => {
          try {
            cctx.clearRect(0, 0, composite.width, composite.height);
            cctx.drawImage(srcCanvas, 0, 0, composite.width, composite.height);
            // 필요 시 오버레이 비트맵 갱신
            ensureOverlayUpdated();
            if (overlayReadyRef.current && overlayImgRef.current) {
              cctx.drawImage(overlayImgRef.current, 0, 0, composite.width, composite.height);
            }
          } catch (_) { }
          raf = requestAnimationFrame(draw);
        };
        draw();
        cleanupComposite = () => {
          if (raf) cancelAnimationFrame(raf);
          if (overlayObserverRef.current) {
            try { overlayObserverRef.current.disconnect(); } catch (_) { }
            overlayObserverRef.current = null;
          }
          if (overlayUrlRef.current) {
            try { URL.revokeObjectURL(overlayUrlRef.current); } catch (_) { }
            overlayUrlRef.current = null;
          }
          overlayReadyRef.current = false;
          overlayLoadingRef.current = false;
        };
        renderCanvas = composite;
      }
    }

    const stream = renderCanvas.captureStream(30);
    const mimeTypeCandidates = [
      'video/mp4; codecs="h264"',
      'video/webm; codecs=vp9',
      'video/webm; codecs=vp8',
      'video/webm'
    ];
    const supportedMime = mimeTypeCandidates.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));

    try {
      const mr = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const mime = supportedMime || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
      
        // ✅ 합성 반복 정리 (오타 수정)
        if (compositeCleanupRef.current) {
          try { compositeCleanupRef.current(); } catch(_) {}
          compositeCleanupRef.current = null;
        }
      
        // 공통 유틸
        const downloadFallback = (blob, filename) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 0);
        };
      
        const promptUpload = async (payload, suggestedName) => {
          if (navigatingRef.current) return;
          navigatingRef.current = true;
          const choice = await Swal.fire({
            title: '업로드 하시겠어요?',
            text: '방금 저장한 영상을 커뮤니티에 업로드합니다.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '업로드',
            cancelButtonText: '취소',
            allowOutsideClick: false,
            allowEscapeKey: false,
            reverseButtons: true
          });
          if (choice.isConfirmed) {
            onRequestUpload?.(payload);
          } else {
            navigatingRef.current = false; // 취소 시 다시 허용
          }
        };
      
        try {
          const suggestedName = `webcam_recording_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
          const arrayBuffer = await blob.arrayBuffer();
      
          // ✅ 항상 메인 프로세스에 저장을 위임 (mp4 직접지원 분기 제거 -> 중복/타이밍 이슈 해소)
          const result = await window.electronAPI?.saveVideo(arrayBuffer, suggestedName);
      
          if (!result?.ok && !result?.canceled) {
            console.error('IPC save-video failed:', result);
            // ❗ IPC 실패 시에만 WebM 다운로드 폴백
            downloadFallback(blob, suggestedName.replace(/\.mp4$/i, '.webm'));
            return;
          }
      
          if (result?.ok && result?.filePath) {
            try {
              localStorage.setItem('lastSavedVideoPath', result.filePath);
              localStorage.setItem('lastSavedVideoName', suggestedName);
            } catch(_) {}
            // ✅ 파일 경로 기반 업로드로 통일 (Electron 친화적)
            await promptUpload({ videoFilePath: result.filePath, suggestedName }, suggestedName);
            // 업로드 완료 후 navigatingRef 리셋
            navigatingRef.current = false;
          }
          // 사용자가 취소(canceled)하면 아무 것도 하지 않음
        } catch (err) {
          console.error('IPC 저장 예외, WebM 폴백:', err);
          downloadFallback(blob, `webcam_recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`);
        }
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      // 합성 정리 핸들 저장 (녹화 중 유지)
      compositeCleanupRef.current = cleanupComposite;
      // 타이머 시작
      recordStartRef.current = Date.now();
      setElapsedMs(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - recordStartRef.current);
      }, 1000);
      setIsRecording(true);
    } catch (e) {
      console.error('녹화 시작 실패:', e);
    }
  }, [isRecording, recordOverlay]);

  // 녹화 종료


  const formatTime = useCallback((ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }, []);

  return (
    <div className={`dots-area${!settingOpen ? ' camera-area--full' : ''}${loopIslandExpanded ? ' loop-island-expanded' : ''}`}>
      <div className="camera-box" style={{ position: 'relative' }}>
        <WebcamRenderComponent
          webcamOn={webcamOn}
          streamStatus={streamStatus}
          isRecording={isRecording}
          startRecording={startRecording}
          stopRecording={stopRecording}
          recordOverlay={recordOverlay}
          setRecordOverlay={setRecordOverlay}
          canvasRef={canvasRef}
          elapsedMs={elapsedMs}
          formatTime={formatTime}
        />
        {streamStatus === 'streaming' ? (
          <>
            {/* webcamOn=false면 WebcamRenderComponent가 null을 반환하여 캔버스/버튼 미표시 */}
            {/* 오버레이 - 초기 설정 중이 아닐 때만 표시 */}
            {!isInitialSetup && (
              showSelectedOverlay ? (
                <ObjectOverlaySelected
                  selectedObjects={selectedObjects}
                  onObjectClick={handleObjectClick}
                  onSelectedObjectChange={handleSelectedObjectChange}
                  selectedObjectForMapping={selectedObjectForMapping}
                  svgRef={overlaySvgRef}
                  containerStyle={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    pointerEvents: 'auto' // 클릭 활성화
                  }}
                />
              ) : (
                <ObjectOverlayAll
                  selectedObjects={selectedObjects}
                  onObjectClick={handleObjectClick}
                  svgRef={overlaySvgRef}
                  containerStyle={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}
                />
              )
            )}

            {/* Mediapipe 손 랜드마크 오버레이 (initial/selection 단계에서는 숨김) */}
            {mediapipeOn && !isInitialSetup && !isSelectionView && (
              <HandsOverlay
                svgRef={undefined}
                containerStyle={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 12,
                  pointerEvents: 'none'
                }}
              />
            )}
            {imageError && (
              <div style={{
                color: 'red',
                textAlign: 'center',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 20
              }}>
                이미지 로딩 실패
              </div>
            )}
          </>
        ) : null}
      </div>
      
      {/* 루프 아일랜드 컴포넌트 - dots-area 하단에 위치 */}
      {React.cloneElement(loopIslandComponent, {
        onExpandedChange: setLoopIslandExpanded
      })}
      
      {!settingOpen && (
        <button className="side-toggle-btn right" onClick={onOpen} aria-label="패널 열기">{ArrowIcon}</button>
      )}
    </div>
  );
}

export default CameraComponent;