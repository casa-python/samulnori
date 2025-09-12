import { create } from 'zustand';

// 과거 로컬 키 정리 (만약 존재한다면)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('object-selection-state');
  }
} catch {}

const useObjectSelectionStore = create((set, get) => ({
  // 선택된 사물들의 key 값들 (trackId 배열)
  selectedObjectKeys: [],
  
  // 사물별 소리 매핑 정보
  objectSoundMapping: {}, // { trackId: soundType }
  
  // 사물별 양손-손가락-사운드 매핑 정보
  objectFingerSoundMapping: {}, // { trackId: { left: { '0': soundType, ... }, right: { '0': soundType, ... } } }
  
  // 액션들
  setSelectedObjectKeys: (keys) => set({ selectedObjectKeys: keys }),
  
  addSelectedObjectKey: (key) => set((state) => ({
    selectedObjectKeys: [...state.selectedObjectKeys, key]
  })),
  
  removeSelectedObjectKey: (key) => set((state) => ({
    selectedObjectKeys: state.selectedObjectKeys.filter(k => k !== key)
  })),
  
  toggleSelectedObjectKey: (key) => {
    const state = get();
    const currentKeys = state.selectedObjectKeys;
    
    if (currentKeys.includes(key)) {
      // 이미 선택된 경우 제거
      set({ selectedObjectKeys: currentKeys.filter(k => k !== key) });
    } else {
      // 선택되지 않은 경우 추가
      set({ selectedObjectKeys: [...currentKeys, key] });
    }
  },
  
  // 사물별 소리 매핑 설정
  setObjectSoundMapping: (trackId, soundType) => set((state) => ({
    objectSoundMapping: {
      ...state.objectSoundMapping,
      [trackId]: soundType
    }
  })),
  
  // 특정 사물의 소리 매핑 가져오기
  getObjectSoundMapping: (trackId) => {
    const state = get();
    return state.objectSoundMapping[trackId] || null;
  },

  // 손가락-사운드 매핑 설정 (양손) - 개별 finger 업데이트, 전체 객체 { name, id } 저장
  setObjectFingerSoundMapping: (trackId, hand, finger, soundData) => {
    set((state) => ({
      objectFingerSoundMapping: {
        ...state.objectFingerSoundMapping,
        [trackId]: {
          ...(state.objectFingerSoundMapping[trackId] || {}),
          [hand]: {
            ...((state.objectFingerSoundMapping[trackId] || {})[hand] || {}),
            [finger]: soundData // 전체 객체 저장
          }
        }
      }
    }));
  },

  // 손가락-사운드 매핑 설정 (통째로 교체) - 저장 시 사용
  replaceObjectFingerSoundMapping: (trackId, fullMapping) => {
    const safeMapping = {
      left: { ...(fullMapping?.left || {}) },
      right: { ...(fullMapping?.right || {}) }
    };
    set((state) => ({
      objectFingerSoundMapping: {
        ...state.objectFingerSoundMapping,
        [trackId]: safeMapping
      }
    }));
  },

  // 특정 사물의 양손-손가락-사운드 매핑 가져오기
  getObjectFingerSoundMapping: (trackId) => {
    const state = get();
    return state.objectFingerSoundMapping[trackId] || { left: {}, right: {} };
  },
  
  // API로 사물 제거 요청 + 내부 상태 정리 (단일 또는 복수)
  removeObjectsWithApi: async (trackIds) => {
    const ids = Array.isArray(trackIds) ? trackIds : [trackIds];
    try {
      await fetch('http://localhost:8000/api/object/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids)
      });
    } catch (e) {
      console.error('사물 제거 API 호출 실패:', e);
    }
    // 내부 상태 정리
    set((state) => {
      const newSelected = state.selectedObjectKeys.filter((k) => !ids.includes(k));
      const newSoundMapping = { ...state.objectSoundMapping };
      const newFingerMapping = { ...state.objectFingerSoundMapping };
      ids.forEach((id) => {
        delete newSoundMapping[id];
        delete newFingerMapping[id];
      });
      return {
        selectedObjectKeys: newSelected,
        objectSoundMapping: newSoundMapping,
        objectFingerSoundMapping: newFingerMapping
      };
    });
  },
  
  // 전체 상태 초기화
  reset: () => set({
    selectedObjectKeys: [],
    objectSoundMapping: {},
    objectFingerSoundMapping: {}
  })
}));

export default useObjectSelectionStore; 