import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import useSoundMapping from '../../hooks/useSoundMapping';
import '../../styles/common/SoundMappingModal.css';

function SoundMappingModal({ open, onClose, object, onSave, initialMapping, treeData }) {
  const {
    gloves,
    dragOverTarget,
    mappingStatus,
    fingerPositions,
    setDragOverTarget,
    setDraggedSound,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleHandDrop,
    handleSave,
    resetLocalMapping
  } = useSoundMapping({ open, object, onSave });

  // 모달 지역 상태는 훅 순서를 지키기 위해 조기 리턴 전에 선언한다
  const [localTree, setLocalTree] = useState([]);
  const [fileVolumeMap, setFileVolumeMap] = useState({});
  // 폴더 접힘 상태 관리: 집합에 포함되면 접힘(collapsed)
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());
  // 미리듣기 재생 상태 관리
  const [previewPlayingId, setPreviewPlayingId] = useState(null);
  const currentPreviewIdRef = useRef(null);
  const webAudioSourceRef = useRef(null);

  const isFolderExpanded = (key) => !collapsedFolders.has(key);
  const toggleFolder = (key) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 트리에서 폴더 키 수집
  const collectFolderKeys = (nodes, parentPath = '', acc = new Set()) => {
    if (!Array.isArray(nodes)) return acc;
    nodes.forEach((node) => {
      const nodeKey = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node?.type === 'folder') {
        acc.add(nodeKey);
        if (Array.isArray(node.children) && node.children.length > 0) {
          collectFolderKeys(node.children, nodeKey, acc);
        }
      }
    });
    return acc;
  };

  // 모달이 열릴 때 기본 samples 폴더 로드
  useEffect(() => {
    if (open && (!treeData || treeData.length === 0) && (!localTree || localTree.length === 0)) {
      const loadDefaultSamples = async () => {
        try {
          if (window.electronAPI?.loadDefaultSamples) {
            // samples 폴더를 기본값으로 로드
            const result = await window.electronAPI.loadDefaultSamples();
            if (result && Array.isArray(result.tree)) {
              setLocalTree(result.tree);
            }
          }
        } catch (error) {
          console.log('기본 samples 폴더 로드 실패:', error);
        }
      };
      loadDefaultSamples();
    }
  }, [open, treeData, localTree]);

  // 초기에는 모든 폴더를 접은 상태로 설정
  useEffect(() => {
    const activeTree = (localTree && localTree.length > 0) ? localTree : treeData;
    if (!activeTree || activeTree.length === 0) return;
    const allFolderKeys = collectFolderKeys(activeTree);
    setCollapsedFolders(allFolderKeys);
  }, [localTree, treeData]);

  // 오디오 재생기: 단일 인스턴스 유지
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try { audioCtxRef.current = new AC(); } catch {}
    }
    // 이벤트 리스너로 재생 종료 시 UI 상태 복원
    const player = audioRef.current;
    const handleEnded = () => {
      setPreviewPlayingId(null);
      currentPreviewIdRef.current = null;
    };
    player.addEventListener('ended', handleEnded);
    return () => {
      try {
        audioRef.current?.pause();
        audioRef.current && (audioRef.current.src = '');
        if (audioCtxRef.current) {
          try { audioCtxRef.current.close(); } catch {}
          audioCtxRef.current = null;
        }
        try { player.removeEventListener('ended', handleEnded); } catch {}
        try {
          webAudioSourceRef.current?.stop(0);
          webAudioSourceRef.current?.disconnect();
        } catch {}
        webAudioSourceRef.current = null;
        currentPreviewIdRef.current = null;
      } catch {}
    };
  }, []);

  // 열림/닫힘 애니메이션을 위한 마운트 유지
  const [shouldRender, setShouldRender] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    // 닫힐 때는 애니메이션 후 언마운트
    if (shouldRender) {
      setIsClosing(true);
      const timeout = setTimeout(() => {
        setIsClosing(false);
        setShouldRender(false);
      }, 230); // CSS 애니메이션과 동기화
      return () => clearTimeout(timeout);
    }
  }, [open, shouldRender]);

  if (!shouldRender || !object) return null;

  const fingerNames = {
    '0': '엄지',
    '1': '검지',
    '2': '중지',
    '3': '약지',
    '4': '새끼',
    '5': '손바닥',
    '6': '손날'
  };

  const handleCloseButtonClick = () => onClose();
  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };
  const handleSaveClick = async () => {
    await handleSave();
    if (typeof onClose === 'function') onClose();
  };

  // 미리듣기 정지
  const stopPreview = () => {
    try { audioRef.current?.pause(); } catch {}
    try {
      if (webAudioSourceRef.current) {
        webAudioSourceRef.current.stop(0);
        webAudioSourceRef.current.disconnect();
      }
    } catch {}
    webAudioSourceRef.current = null;
    currentPreviewIdRef.current = null;
    setPreviewPlayingId(null);
  };

  // 사운드 미리듣기 (메인에서 읽어온 data URL 사용)
  const playPreview = async (soundPath, volume) => {
    try {
      if (!window.electronAPI?.readAudioAsDataUrl) {
        return;
      }
      // 같은 항목 재클릭 시 토글 정지
      if (previewPlayingId === soundPath) {
        stopPreview();
        return;
      }
      const dataUrl = await window.electronAPI.readAudioAsDataUrl(soundPath);
      if (!dataUrl || !audioRef.current) {
        return;
      }
      // 이전 재생 중단 후 설정
      stopPreview();
      const player = audioRef.current;
      player.currentTime = 0;
      player.src = dataUrl;
      player.volume = Math.min(Math.max(volume ?? 1, 0), 1);
      currentPreviewIdRef.current = soundPath;
      setPreviewPlayingId(soundPath);
      await player.play().catch(async (e) => {
        // Fallback: WebAudio로 재생 시도
        if (!audioCtxRef.current) return;
        const res = await fetch(dataUrl);
        const buf = await res.arrayBuffer();
        const ctx = audioCtxRef.current;
        try {
          const decoded = await ctx.decodeAudioData(buf.slice(0));
          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          gain.gain.value = Math.min(Math.max(volume ?? 1, 0), 1);
          source.buffer = decoded;
          source.connect(gain).connect(ctx.destination);
          try {
            webAudioSourceRef.current?.stop(0);
            webAudioSourceRef.current?.disconnect();
          } catch {}
          webAudioSourceRef.current = source;
          currentPreviewIdRef.current = soundPath;
          setPreviewPlayingId(soundPath);
          source.onended = () => {
            if (currentPreviewIdRef.current === soundPath) {
              setPreviewPlayingId(null);
              currentPreviewIdRef.current = null;
            }
            try { source.disconnect(); } catch {}
            if (webAudioSourceRef.current === source) {
              webAudioSourceRef.current = null;
            }
          };
          source.start(0);
        } catch (e) {
          console.error('오디오 재생 실패:', e);
        }
      });
    } catch (e) {
      console.error('미리듣기 실패:', e);
    }
  };

  // 사운드 트리 렌더링 함수
  const renderSoundTree = (nodes, level = 0, parentPath = '') => {
    return nodes.map((node, index) => {
      const nodeKey = parentPath ? `${parentPath}/${node.name}` : node.name;
      const expanded = node.type === 'folder' ? isFolderExpanded(nodeKey) : true;
      return (
        <div key={`${nodeKey}-${index}`}>
          <div
            className={`sound-tree-item ${node.type}`}
            style={{ paddingLeft: `${level * 16}px` }}
            draggable={node.type === 'file'}
            onClick={(e) => { if (node.type === 'folder') { e.stopPropagation(); toggleFolder(nodeKey); } }}
            onDragStart={(e) => handleDragStart(e, node.name, node.id, fileVolumeMap[node.id] ?? 1)}
            onDragEnd={(e) => { e.preventDefault(); }}
            aria-expanded={node.type === 'folder' ? expanded : undefined}
          >
            <span className="sound-tree-icon">{node.type === 'folder' ? '📁' : '🎵'}</span>
            <div className="sound-tree-row-grid">
              <span className="sound-tree-name">
                {node.type === 'folder' && (
                  <span className="sound-tree-toggle">{expanded ? '▾' : '▸'}</span>
                )}
                {node.name}
              </span>
              {node.type === 'file' && node.id && (
                <>
                  <button
                    type="button"
                    className={`sound-tree-play ${previewPlayingId === node.id ? 'playing' : ''}`}
                    onClick={(e) => { e.stopPropagation(); playPreview(node.id, fileVolumeMap[node.id] ?? 1); }}
                    title={previewPlayingId === node.id ? '정지' : '미리듣기'}
                  >{previewPlayingId === node.id ? '⏸' : '▶'}</button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={fileVolumeMap[node.id] ?? 1}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setFileVolumeMap((prev) => ({ ...prev, [node.id]: Number(e.target.value) }))}
                    className="sound-tree-volume"
                    title="볼륨"
                  />
                </>
              )}
            </div>
          </div>
          {node.children && node.children.length > 0 && expanded && (
            <div>{renderSoundTree(node.children, level + 1, nodeKey)}</div>
          )}
        </div>
      );
    });
  };

  const modalContent = (
    <div className={`sound-mapping-modal-overlay${isClosing ? ' closing' : ''}`} onClick={handleOverlayClick}>
      <div className={`sound-mapping-modal-content${isClosing ? ' closing' : ''}`}>
        {/* 헤더 (스티키) */}
        <div className="sound-mapping-header">
          <div className="sound-mapping-header-content">
            <div className="sound-mapping-title">
              <div className="sound-mapping-title-content">
                <h2>🎵 글러브 사운드 매핑</h2>
                <p>{object.class_name}_{object.trackId}</p>
              </div>
              <p>샘플을 글러브 매핑에 드래그하세요.</p>
            </div>
            
            {/* 푸터 (스티키) */}
            <div className="sound-mapping-footer">
              <button className="sound-mapping-save-button" onClick={handleSaveClick}>저장</button>
            </div>
          </div>
          <button className="sound-mapping-close-button" onClick={handleCloseButtonClick} aria-label="닫기">×</button>
        </div>

        {/* 메인 컨텐츠 (좌: 상태/사운드 목록, 우: 손 매핑) */}
        <div className="sound-mapping-main-content">
          {/* 왼쪽: 상태 + 사운드 목록 */}
          <div className="sound-mapping-left">
            {/* 상태 바 (컴팩트) */}
            <div className="sound-mapping-status">
              <div className="sound-mapping-status-title"><span>📋</span>현재 매핑 상태</div>
              <div className="sound-mapping-status-content" title={mappingStatus}>
                <div className="sound-mapping-status-grid">
                  <div className="status-col">
                    <div className="status-col-header">🖐️ LEFT</div>
                    <div className="status-col-rows">
                      {fingerPositions.left.map((pos) => (
                        <div className="status-row" key={`status-left-${pos.id}`}>
                          <span className="status-row-label">L-{pos.id} ({fingerNames[pos.id]})</span>
                          <span className="status-row-sep">|</span>
                          <span className={`status-row-value ${gloves.left[pos.id] ? 'mapped' : 'unmapped'}`}>
                            {gloves.left[pos.id]?.name || '미설정'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="status-col">
                    <div className="status-col-header">🖐️ RIGHT</div>
                    <div className="status-col-rows">
                      {fingerPositions.right.map((pos) => (
                        <div className="status-row" key={`status-right-${pos.id}`}>
                          <span className="status-row-label">R-{pos.id} ({fingerNames[pos.id]})</span>
                          <span className="status-row-sep">|</span>
                          <span className={`status-row-value ${gloves.right[pos.id] ? 'mapped' : 'unmapped'}`}>
                            {gloves.right[pos.id]?.name || '미설정'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 사운드 목록 */}
            <div className="sound-mapping-sound-list">
            <div className="sound-mapping-sound-list-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📋 사운드 목록</span>
              <button
                type="button"
                className="sound-mapping-folder-button"
                onClick={async () => {
                  try {
                    const result = await window.electronAPI?.selectSampleFolder?.();
                    if (result && Array.isArray(result.tree)) {
                      // SoundMappingModal은 받은 treeData를 그대로 쓰므로, 상위 컴포넌트의 상태를 바꾸지 않고 내부 지역 상태로 표시
                      // 간편하게 현재 컴포넌트 레벨에서 임시로 treeData를 대체 표시하기 위해 setLocalTree 사용
                      setLocalTree(result.tree);
                    }
                  } catch {}
                }}
              >샘플 폴더 선택</button>
            </div>
            <div className="sound-mapping-sound-list-container">
              {(localTree && localTree.length > 0) || (treeData && treeData.length > 0) ? (
                <div className="sound-mapping-sound-list-content">{renderSoundTree(localTree && localTree.length > 0 ? localTree : treeData)}</div>
                             ) : (
                 <div className="sound-mapping-sound-list-loading">원하시는 사운드 샘플 경로를 선택해주세요.</div>
               )}
            </div>
            </div>

            {/* 왼쪽 컬럼 종료 */}
          </div>

          {/* 오른쪽: 손 매핑 */}
          <div className="sound-mapping-hands-container">
            <div className="sound-mapping-hands-title-container">
              <div className="sound-mapping-hands-title">글러브 매핑</div>
              
              {/* 로컬 초기화 버튼 */}
              <button
                  type="button"
                  className="sound-mapping-reset-button"
                  onClick={resetLocalMapping}
                  title="모달 내 매핑 초기화 (스토어에는 영향 없음)"
                >매핑 초기화</button>
            </div>
            
            <div className="sound-mapping-hands-image-container">
              {/* 왼손 매핑 포인트들 */}
              {fingerPositions.left.map((pos) => (
                <div
                  key={`left-${pos.id}`}
                  className={`sound-mapping-finger-point ${gloves.left[pos.id] ? 'mapped' : 'unmapped'} ${dragOverTarget === `left-${pos.id}` ? 'drag-over' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onDragOver={(e) => handleDragOver(e, `left-${pos.id}`)}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`left-${pos.id}`); }}
                  onDragLeave={(e) => handleDragLeave(e)}
                  onDrop={(e) => handleDrop(e, 'left', pos.id)}
                  title={`왼손 ${pos.id}번: ${gloves.left[pos.id] ? `${gloves.left[pos.id].name} (ID: ${gloves.left[pos.id].id})` : '미설정'}`}
                >L-{pos.id}</div>
              ))}

              {/* 오른손 매핑 포인트들 */}
              {fingerPositions.right.map((pos) => (
                <div
                  key={`right-${pos.id}`}
                  className={`sound-mapping-finger-point ${gloves.right[pos.id] ? 'mapped' : 'unmapped'} ${dragOverTarget === `right-${pos.id}` ? 'drag-over' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onDragOver={(e) => handleDragOver(e, `right-${pos.id}`)}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`right-${pos.id}`); }}
                  onDragLeave={(e) => handleDragLeave(e)}
                  onDrop={(e) => handleDrop(e, 'right', pos.id)}
                  title={`오른손 ${pos.id}번: ${gloves.right[pos.id] ? `${gloves.right[pos.id].name} (ID: ${gloves.right[pos.id].id})` : '미설정'}`}
                >R-{pos.id}</div>
              ))}

              {/* 왼손 전체 드롭 영역 */}
              <div
                className={`sound-mapping-hand-drop-area left ${dragOverTarget === 'left-hand' ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'left-hand')}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget('left-hand'); }}
                onDragLeave={(e) => handleDragLeave(e)}
                onDrop={(e) => handleHandDrop(e, 'left')}
                title="왼손 전체에 매핑"
              >LEFT</div>

              {/* 오른손 전체 드롭 영역 */}
              <div
                className={`sound-mapping-hand-drop-area right ${dragOverTarget === 'right-hand' ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'right-hand')}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget('right-hand'); }}
                onDragLeave={(e) => handleDragLeave(e)}
                onDrop={(e) => handleHandDrop(e, 'right')}
                title="오른손 전체에 매핑"
              >RIGHT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default SoundMappingModal;