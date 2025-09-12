import { useState, useEffect, useCallback } from 'react';
import useObjectSelectionStore from '../stores/objectSelectionStore';

/**
 * 사운드 매핑 모달 전용 훅
 * - gloves 상태, 드래그 앤 드롭, 저장(API 전송 포함), 상태 텍스트 관리
 */
export default function useSoundMapping({ open, object, onSave }) {
  const [gloves, setGloves] = useState({ left: {}, right: {} });
  const [draggedSound, setDraggedSound] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [mappingStatus, setMappingStatus] = useState('매핑을 시작해주세요');

  const {
    setObjectFingerSoundMapping,
    getObjectFingerSoundMapping,
    replaceObjectFingerSoundMapping
  } = useObjectSelectionStore();

  // 손가락 위치 (0~4)
  const fingerPositionOffsetX = 15;
  const fingerPositionOffsetY = -12;
  const fingerPositions = {
    left: [
      { id: '0', x: 22 - fingerPositionOffsetX, y: 35 - fingerPositionOffsetY },
      { id: '1', x: 33 - fingerPositionOffsetX, y: 3 - fingerPositionOffsetY },
      { id: '2', x: 40 - fingerPositionOffsetX, y: 0 - fingerPositionOffsetY },
      { id: '3', x: 46 - fingerPositionOffsetX, y: 3 - fingerPositionOffsetY },
      { id: '4', x: 52 - fingerPositionOffsetX, y: 13 - fingerPositionOffsetY },
      { id: '5', x: 38 - fingerPositionOffsetX, y: 58 - fingerPositionOffsetY },
      { id: '6', x: 52 - fingerPositionOffsetX, y: 58 - fingerPositionOffsetY }
    ],
    right: [
      { id: '0', x: 73 + fingerPositionOffsetX, y: 35 - fingerPositionOffsetY },
      { id: '1', x: 61 + fingerPositionOffsetX, y: 3 - fingerPositionOffsetY },
      { id: '2', x: 54 + fingerPositionOffsetX, y: 0 - fingerPositionOffsetY },
      { id: '3', x: 48 + fingerPositionOffsetX, y: 3 - fingerPositionOffsetY },
      { id: '4', x: 43 + fingerPositionOffsetX, y: 13 - fingerPositionOffsetY },
      { id: '5', x: 57 + fingerPositionOffsetX, y: 58 - fingerPositionOffsetY },
      { id: '6', x: 43 + fingerPositionOffsetX, y: 58 - fingerPositionOffsetY }
    ]
  };

  const updateMappingStatus = useCallback((currentGloves) => {
    const leftMappings = Object.entries(currentGloves.left).filter(([, sound]) => sound);
    const rightMappings = Object.entries(currentGloves.right).filter(([, sound]) => sound);

    if (leftMappings.length === 0 && rightMappings.length === 0) {
      setMappingStatus('매핑을 시작해주세요');
    } else {
      const status = [];
      if (leftMappings.length > 0) {
        status.push(`왼손: ${leftMappings.map(([f, s]) => `${f}번→${s.name}`).join(', ')}`);
      }
      if (rightMappings.length > 0) {
        status.push(`오른손: ${rightMappings.map(([f, s]) => `${f}번→${s.name}`).join(', ')}`);
      }
      setMappingStatus(status.join(' | '));
    }
  }, []);

  // 초기화
  useEffect(() => {
    if (open && object?.trackId) {
      const existing = getObjectFingerSoundMapping(object.trackId) || { left: {}, right: {} };
      const toGloves = (handData) => {
        const converted = {};
        Object.entries(handData || {}).forEach(([finger, soundData]) => {
          if (!soundData) return;
          if (typeof soundData === 'object' && (soundData.id || soundData.name)) {
            converted[finger] = soundData;
          } else if (typeof soundData === 'string') {
            const fileName = soundData.split('/').pop() || soundData;
            converted[finger] = { name: fileName, id: soundData };
          }
        });
        return converted;
      };
      const next = { left: toGloves(existing.left), right: toGloves(existing.right) };
      setGloves(next);
      updateMappingStatus(next);
    }
  }, [open, object?.trackId, getObjectFingerSoundMapping, updateMappingStatus]);

  useEffect(() => {
    updateMappingStatus(gloves);
  }, [gloves, updateMappingStatus]);

  // 로컬 매핑 초기화 (스토어에는 영향 없음)
  const resetLocalMapping = useCallback(() => {
    setGloves({ left: {}, right: {} });
    setMappingStatus('매핑을 시작해주세요');
  }, []);

  // DnD
  const handleDragStart = (e, soundName, soundId, volume) => {
    const vol = typeof volume === 'number' ? volume : 1;
    setDraggedSound({ name: soundName, id: soundId, volume: vol });
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', JSON.stringify({ name: soundName, id: soundId, volume: vol }));
  };

  const handleDragOver = (e, target) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverTarget(target);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null);
  };

  const pickDropped = (e) => {
    try {
      const droppedData = e.dataTransfer.getData('text/plain');
      return droppedData ? JSON.parse(droppedData) : draggedSound;
    } catch {
      return draggedSound;
    }
  };

  const handleDrop = useCallback((e, hand, fingerId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSound) return;
    const dropped = pickDropped(e);
    if (dropped && dropped.id) {
      setGloves((prev) => {
        const L = { ...prev.left };
        const R = { ...prev.right };
        const data = { ...dropped, volume: typeof dropped.volume === 'number' ? dropped.volume : 1 };
        if (hand === 'left') L[fingerId] = data; else R[fingerId] = data;
        const next = { left: L, right: R };
        if (process.env.NODE_ENV === 'development') console.log('🎵 개별 손가락 드롭 후 gloves 객체:', next);
        return next;
      });
    }
    setDraggedSound(null);
    setDragOverTarget(null);
  }, [draggedSound]);

  const handleHandDrop = useCallback((e, hand) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSound) return;
    const dropped = pickDropped(e);
    if (dropped && dropped.id) {
      setGloves((prev) => {
        const L = { ...prev.left };
        const R = { ...prev.right };
        const data = { ...dropped, volume: typeof dropped.volume === 'number' ? dropped.volume : 1 };
        const target = hand === 'left' ? L : R;
        for (let i = 0; i <= 6; i++) target[i.toString()] = data;
        const next = { left: L, right: R };
        if (process.env.NODE_ENV === 'development') console.log('🎵 전체 손 드롭 후 gloves 객체:', next);
        return next;
      });
    }
    setDraggedSound(null);
    setDragOverTarget(null);
  }, [draggedSound]);

  // 저장 + API (교체 방식)
  const handleSave = useCallback(async () => {
    if (!object?.trackId) return;

    const normalize = (handMap) => {
      const out = {};
      Object.entries(handMap || {}).forEach(([fingerId, soundData]) => {
        if (!soundData) return;
        if (typeof soundData === 'object' && soundData.id) {
          out[String(fingerId)] = { name: soundData.name, id: soundData.id, volume: typeof soundData.volume === 'number' ? soundData.volume : 1 };
        } else if (typeof soundData === 'string') {
          const fileName = soundData.split('/').pop() || soundData;
          out[String(fingerId)] = { name: fileName, id: soundData, volume: 1 };
        }
      });
      return out;
    };

    const normalized = {
      left: normalize(gloves.left),
      right: normalize(gloves.right)
    };

    // 스토어에 통째로 교체 저장
    replaceObjectFingerSoundMapping(object.trackId, normalized);

    // 저장 콜백 (옵셔널)
    if (onSave) {
      for (const hand of ['left', 'right']) {
        for (const [fingerId, soundData] of Object.entries(normalized[hand])) {
          onSave(object.trackId, hand, fingerId, { name: soundData.name, id: soundData.id, volume: soundData.volume });
        }
      }
    }

    // API payload - 모든 손가락(0-4)에 대해 매핑 여부와 관계없이 요청
    const payload = [];
    for (const hand of ['left', 'right']) {
      for (let fingerId = 0; fingerId <= 6; fingerId++) {
        const soundData = normalized[hand][String(fingerId)];
        payload.push({
          hand: hand,
          sensor_idx: fingerId,
          path: soundData ? soundData.id : 'null', // 매핑되지 않은 손가락은 null
          volume: soundData ? soundData.volume : 1
        });
      }
    }

    try {
      const res = await fetch(`http://localhost:8000/api/object/${object.trackId}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        console.error('사운드 매핑 API 오류:', res.status, res.statusText);
      } else {
        const result = await res.json();
        console.log('사운드 매핑 API 응답:', result);
      }
    } catch (e) {
      console.error('사운드 매핑 API 호출 실패:', e);
    }
  }, [gloves, object?.trackId, replaceObjectFingerSoundMapping, onSave]);

  return {
    // state
    gloves,
    dragOverTarget,
    mappingStatus,
    fingerPositions,
    // actions
    setDragOverTarget,
    setDraggedSound,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleHandDrop,
    handleSave,
    resetLocalMapping
  };
}
