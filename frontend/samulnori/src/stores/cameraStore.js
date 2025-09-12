import { create } from 'zustand';

// 과거에 저장된 로컬 키가 있었다면 정리 (보조 처리)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('camera-store-state');
  }
} catch {}

const useCameraStore = create((set, get) => ({
  // 웹캠 스트림 상태
  streamStatus: 'waiting', // waiting, processing, streaming, error
  streamReady: false,
  imageLoading: false,
  imageError: false,
  
  // 이미지 데이터
  imageDimensions: { width: 640, height: 480 },
  inferenceData: null,
  selectedObjects: [],
  
  // 결과 화면 상태
  isResultView: false,
  resultClassIds: [],
  
  // Canvas 관련
  canvasRef: null,
  imageObjRef: null,
  
  // Canvas 렌더링 정보 (좌표 변환용)
  canvasRenderInfo: {
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    containerWidth: 0,
    containerHeight: 0
  },
  
  // 액션들
  setStreamStatus: (status) => set({ streamStatus: status }),
  setStreamReady: (ready) => set({ streamReady: ready }),
  setImageLoading: (loading) => set({ imageLoading: loading }),
  setImageError: (error) => set({ imageError: error }),
  
  setImageDimensions: (dimensions) => set({ imageDimensions: dimensions }),
  setInferenceData: (data) => set({ inferenceData: data }),
  
  addSelectedObject: (object) => set((state) => ({
    selectedObjects: [...state.selectedObjects, object]
  })),
  
  removeSelectedObject: (objectId) => set((state) => ({
    selectedObjects: state.selectedObjects.filter(obj => obj.uniqueId !== objectId)
  })),
  
  // 최적화된 toggleSelectedObject 함수
  toggleSelectedObject: (object) => {
    const state = get();
    const currentSelectedObjects = state.selectedObjects;
    
    // trackId를 사용하여 객체 식별
    const existingIndex = currentSelectedObjects.findIndex(selected => 
      selected.trackId === object.trackId
    );
    
    if (existingIndex !== -1) {
      // 이미 선택된 경우 제거
      const newSelectedObjects = currentSelectedObjects.filter((_, index) => index !== existingIndex);
      set({ selectedObjects: newSelectedObjects });
      console.log('사물 제거됨:', object.class_name, object.trackId);
    } else {
      // 선택되지 않은 경우 추가
      set({ selectedObjects: [...currentSelectedObjects, object] });
      console.log('사물 추가됨:', object.class_name, object.trackId);
    }
  },
  
  // 결과 화면 상태 설정
  setResultView: (isResult, classIds = []) => set({ 
    isResultView: isResult, 
    resultClassIds: classIds 
  }),
  
  setCanvasRef: (ref) => set({ canvasRef: ref }),
  setImageObjRef: (ref) => set({ imageObjRef: ref }),
  
  // Canvas 렌더링 정보 설정
  setCanvasRenderInfo: (renderInfo) => set({ canvasRenderInfo: renderInfo }),
  
  // 스트림 초기화
  resetStream: () => set({
    streamStatus: 'waiting',
    streamReady: false,
    imageLoading: false,
    imageError: false,
    inferenceData: null,
    selectedObjects: []
  }),
  
  // 전체 상태 초기화
  reset: () => set({
    streamStatus: 'waiting',
    streamReady: false,
    imageLoading: false,
    imageError: false,
    imageDimensions: { width: 640, height: 480 },
    inferenceData: null,
    selectedObjects: [],
    isResultView: false,
    resultClassIds: [],
    canvasRef: null,
    imageObjRef: null,
    canvasRenderInfo: {
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      containerWidth: 0,
      containerHeight: 0
    }
  })
}));

export default useCameraStore; 