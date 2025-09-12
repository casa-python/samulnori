# 사물놀이2.0 · Backend/AI

객체(사물) 터치·제스처를 인식해 실시간으로 사운드를 재생하는 AIoT 백엔드 서버입니다. Python(FastAPI) 기반의 마이크로서비스로, YOLO 객체 탐지/추적, MediaPipe 손 인식, 장갑 센서(ESP32 + MQTT/UDP), 오디오 엔진을 통합하여 전송 지연과 지터를 최소화하는 구조를 지향합니다.

> 본 문서는 팀 온보딩 및 운영/배포에 필요한 정보를 한 파일에서 빠르게 파악할 수 있도록 설계되었습니다. 프론트엔드(Electron/React)와의 연동 개요도 포함합니다.

> community 폴더는 Spring Boot로 구현되었습니다. 관련 문서는 ./community 폴더를 참고해주시기 바랍니다.
---

## 주요 기능 (Features)

* **실시간 객체·손 인식 파이프라인**

  * YOLOv8/YOLO11 기반 객체 탐지/추적 (GPU 우선)
  * MediaPipe Hands 기반 손 랜드마크/라벨 보정(손목 컬러마커 우선)
* **센서 융합(Fusion)**

  * 장갑(FSR 등) 센서 입력과 비전 결과를 융합하여 "손-객체-터치" 이벤트 판단
  * 좌/우 장갑 독립 스트림(최대 100 Hz 계획) 처리
* **저지연 오디오 엔진**

  * `sounddevice` 기반, 48 kHz / 소블록(`BLOCKSIZE=256` 기본, 튜닝 가능)
  * 다중 샘플 동시 재생, 온셋 타이밍 정밀화, 스테레오 보정
* **루프·타임라인 관리**

  * 전역 트랜스포트(재생/일시정지/리셋), 메트로놈, 루프 단위 이벤트 스케줄링
  * 외부 이벤트(센서)가 생성한 사운드 이벤트를 안전하게 큐잉
* **저지연 통신**

  * Backend ↔ Frontend: WebSocket (프레임/메타데이터 실시간 스트림)
  * 센서 ↔ Backend: MQTT(TCP) 또는 UDP 수신 워커 선택적 운용

---

## 시스템 아키텍처

```
[ESP32/센서] --(MQTT/UDP)--> [Input Workers]
                                   │
                                   ▼
                          [Queue Manager]
                                   │
      [YOLO Worker]  [MediaPipe Worker]  [Fusion Worker]
             │              │                  │
             └──────┬───────┴──────────────┬───┘
                    ▼                      ▼
                [Loop Manager]  <---->  [Sound Engine]
                    │
                    ▼
            [FastAPI + WS Router]  <---->  [Electron/React]
```

* **workers/**: 센서 수신(UDP/MQTT), 비전 처리(YOLO/MediaPipe), Fusion 모듈
* **managers/**: 큐/상태/루프/스레드 등 코어 매니저
* **routers/**: FastAPI 엔드포인트(REST) + WebSocket 허브

---

## 기술 스택

* Python 3.10+ (개발 환경 3.12 호환 확인)
* FastAPI, Uvicorn
* numpy, sounddevice, soundfile, resampy
* ultralytics (YOLOv8/11), OpenCV, MediaPipe
* paho-mqtt, asyncio, threading
* (선택) PyTorch + CUDA (GPU 추론 가속)

---

## 디렉토리 구조

```
backend/
├─ main.py                        # FastAPI 진입점
├─ aruco_test.py                  # ArUco 실험 스크립트
├─ event_generator.py             # 테스트 이벤트/메트로놈 등 유틸 실행기
├─ assets/                        # 오디오/이미지 등 정적 리소스
├─ custom_tracker/                # (옵션) 커스텀 트래커 구현
├─ managers/
│  ├─ loop_manager.py             # 루프·타임라인·스케줄러
│  ├─ object_manager.py           # 객체(사물) 등록/상태 관리
│  ├─ queue_manager.py            # 공유 큐 (동기/비동기 통신)
│  ├─ status_manager.py           # 런타임/스트리밍/트랜스포트 상태
│  └─ thread_manager.py           # 워커 스레드 수명주기 관리
├─ routers/
│  ├─ loop_router.py              # 전역 트랜스포트/루프/이벤트 REST
│  ├─ object_router.py            # 객체 CRUD/매핑 관련 REST
│  ├─ status_router.py            # 상태 조회/디버그 엔드포인트
│  └─ websocket_router.py         # WebSocket 허브 (프레임/메타데이터)
├─ samples/                       # 샘플 데이터/스크립트
├─ utils/
│  └─ sound_engine.py             # 저지연 오디오 엔진 (48kHz/블록)
├─ workers/
│  ├─ fusion_module/
│  │  ├─ fusion_worker.py         # 손-객체-센서 융합 메인 워커
│  │  ├─ object_binder.py         # 트래킹 객체 ↔ 센서/손 바인딩
│  │  ├─ object_mapper.py         # 객체 ID/속성 맵 관리
│  │  └─ touch_processor.py       # 터치/제스처 판정 로직
│  ├─ mediapipe_module/
│  │  ├─ mediapipe_worker.py      # 손 랜드마크 추출/좌우 라벨 보정
│  │  └─ renderer.py              # 디버그 렌더링/오버레이
│  ├─ yolo_module/
│  │  ├─ models/                  # YOLO 가중치/구성
│  │  ├─ renderer.py              # 디텍션/세그멘테이션 렌더링
│  │  ├─ tracker.yaml             # 트래커 설정(BOTSORT 등)
│  │  └─ yolo_worker.py           # YOLO 추론/추적 워커
│  ├─ encoding_worker.py          # 프레임 인코딩/전송 파이프라인
│  ├─ udp_worker.py               # UDP 수신 워커
│  └─ webcam_worker.py            # 웹캠 캡처 워커
```

## 설치(Setup)

### 1) 의존성

* OS: Windows 10+/Linux/macOS
* (권장) 오디오 드라이버: Windows WASAPI(또는 ASIO), macOS CoreAudio
* GPU 사용 시: NVIDIA GPU + 최신 CUDA 드라이버

### 2) Python 환경

```bash
# 권장: 가상환경
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt
```

### 3) 모델/에셋

```
backend/workers/yolo_module/models/   # YOLO 가중치 배치
backend/assets/                       # 오디오 샘플(mp3/wav)
```

### 4) 환경 변수(.env)

`.env` 또는 OS 환경 변수 설정

```
# 서버
APP_HOST=0.0.0.0
APP_PORT=8000

# MQTT (선택)
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_CLIENT_ID=backend
MQTT_TOPIC_PATTERN=hand/#

# YOLO/MediaPipe
YOLO_MODEL_NAME=yolo11n-seg.pt
FORCE_DEVICE=cuda   # cuda|cpu (미설정 시 자동감지)

# 오디오
AUDIO_SAMPLERATE=48000
AUDIO_BLOCKSIZE=256
```

---

## 실행(Run)

```bash
uvicorn main:app --host ${APP_HOST:-0.0.0.0} --port ${APP_PORT:-8000} --reload
```

* Electron/React 프론트는 `ws://localhost:8000/ws` 로 WebSocket 연결
* 이미지/메타데이터 스트림 및 제어 메시지 양방향 통신

---

## REST API 개요

### 전역 트랜스포트

* `GET  /transport` – 현재 상태 조회
* `POST /transport/start` – 타임라인 시작/재설정
* `POST /transport/stop` – 정지
* `POST /transport/pause` – 일시정지

### 이벤트 입력

* `POST /events/add` – 사운드 이벤트 추가

### 객체/매핑 관리

* `POST /objects` – 객체 등록
* `POST /mappings/bulk_set` – 센서→사운드 매핑 설정
* `POST /mappings/unset` – 매핑 해제

---

## 데이터 형식 & 큐

* **센서 데이터 포맷**: `<I6H` (uint32 timestamp + 6\*uint16 센서)
* **토픽**: `hand/left`, `hand/right`
* **공유 큐**: 동기/비동기 큐 분리, 저지연 전달 최적화

---

## 성능/지연 튜닝 가이드

* 오디오 XRUN 방지: 콜백 최소화, BLOCKSIZE 조정
* GPU 추론 가속: `FORCE_DEVICE=cuda`, 드라이버 일치 확인
* MQTT 지터 최소화: QoS 0, `tcp_nodelay` 활성화, 경량 핸들러
* 라벨 보정: 손목 컬러밴드 우선 규칙, 캐시/히스테리시스 적용

---

## 트러블슈팅

* **오디오 장치 에러**: 디바이스 점유 해제, 샘플레이트 확인
* **XRUN**: 블록사이즈 상향 또는 콜백 단순화
* **YOLO 느림**: GPU 인식 실패, 드라이버 문제 점검
* **WebSocket 불일치**: 독립 코루틴, ping/pong 유지

---

## 로드맵

* [ ] 센서 100 Hz 듀얼스트림 안정화
* [ ] FusionTask occlusion-aware ID 유지
* [ ] MQTT/UDP 전환 핫스왑
* [ ] 자동화 테스트 스윗 추가

---

## 라이선스

사내/팀 정책에 따름.

## 기여

PR 전 lint/format 검사 필수. `managers/*` 기준 명명 규칙 준수.

---

### 부록 A. Wireshark 필터

* UDP: `udp.port == 5006`
* MQTT Publish: `mqtt.msgtype == 3`

### 부록 B. cURL 예시

```bash
curl -X POST http://localhost:8000/transport/start \
     -H 'Content-Type: application/json' \
     -d '{"bars":4,"bpm":120}'
```
