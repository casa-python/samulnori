# Setting Components

설정 관련 컴포넌트들을 관리합니다.

## 구조

```
components/setting/
├── InitialSetupComponent.jsx    # 초기 설정 화면
├── ObjectSelectionComponent.jsx # 사물 선택 화면
├── index.js                     # Barrel export
└── README.md                    # 이 파일
```

## 컴포넌트

### InitialSetupComponent

장치 초기 설정을 담당하는 컴포넌트입니다.

**Props:**
- `webcamStatus` - 웹캠 연결 상태
- `setWebcamStatus` - 웹캠 상태 설정 함수
- `gloveStatus` - 글러브 장치 연결 상태
- `setGloveStatus` - 글러브 상태 설정 함수
- `initDone` - 초기화 완료 여부
- `setInitDone` - 초기화 완료 상태 설정 함수
- `checking` - 확인 중 상태
- `setChecking` - 확인 상태 설정 함수
- `setWsInfo` - WebSocket 정보 설정 함수
- `onInitSuccess` - 초기화 성공 콜백

### ObjectSelectionComponent

사물 선택을 담당하는 컴포넌트입니다.

**Props:**
- `onBack` - 뒤로 가기 콜백
- `streamReady` - 스트림 준비 상태

## 사용법

```jsx
import { 
  InitialSetupComponent, 
  ObjectSelectionComponent 
} from '../components/setting';

// 초기 설정
<InitialSetupComponent
  webcamStatus={webcamStatus}
  setWebcamStatus={setWebcamStatus}
  // ... 기타 props
/>

// 사물 선택
<ObjectSelectionComponent
  onBack={handleBack}
  streamReady={streamReady}
/>
``` 