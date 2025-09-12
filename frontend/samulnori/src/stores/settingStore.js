import { create } from 'zustand';

// 과거 persist로 저장된 값이 남아있을 수 있으므로 진입 시 정리
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('setting-router-state');
  }
} catch {}

// 설정 패널의 현재 화면 및 매핑 데이터를 전역 상태로 관리 (비영속)
const useSettingStore = create((set, get) => ({
  // 'initial' | 'selection' | 'mapping' | 'complete' | 'loop-play'
  currentView: 'initial',
  // ObjectSoundMapping 화면 복원을 위한 데이터
  mappingData: { selectedObjects: [], objectIds: [], apiResult: null },

  setCurrentView: (view) => set({ currentView: view }),
  setMappingData: (data) => set({ mappingData: data }),

  reset: () => set({
    currentView: 'initial',
    mappingData: { selectedObjects: [], objectIds: [], apiResult: null }
  })
}));

export default useSettingStore;
