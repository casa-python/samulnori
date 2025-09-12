import shutil
import ultralytics
import os
import asyncio
import numpy as np

# import시 manager 초기화
from utils.sound_engine import sound_engine
from managers.queue_manager import queue_manager
from managers.status_manager import status_manager
from managers.thread_manager import thread_manager
from managers.object_manager import object_manager
from managers.loop_manager import loop_manager

from workers.webcam_worker import WebcamThread
from workers.encoding_worker import JpegEncoderThread
from workers.yolo_module.yolo_worker import YoloThread
from workers.mediapipe_module.mediapipe_worker import MediaPipeThread
from workers.udp_worker import UdpThread

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import status_router
from routers import websocket_router
from routers import object_router
from routers import loop_router
            
def patch_ultralytics_trackers():
    # 1. 내 커스터마이즈된 트래커 경로
    custom_path = os.path.join(os.path.dirname(__file__), "custom_tracker")

    # 2. ultralytics 내부 site-packages 경로
    ultra_path = os.path.dirname(ultralytics.__file__)
    target_path = os.path.join(ultra_path, "trackers")

    # 3. 덮어쓰기 수행
    if os.path.exists(custom_path):
        shutil.copytree(custom_path, target_path, dirs_exist_ok=True)
        print("✅ Ultralytics trackers patched with custom_tracker.")

def create_app():
    print("🔧 Patching Ultralytics trackers...")
    # 패치 적용
    patch_ultralytics_trackers()
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # 루프 공유 및 비동기 큐에 등록
        loop = asyncio.get_running_loop()
        queue_manager.initialize_async_queues(loop)

        # 스레드 생성 및 등록
        thread_manager.register("webcam", WebcamThread(src=0))
        thread_manager.register("encoder", JpegEncoderThread(quality=80))
        thread_manager.register("yolo", YoloThread(model_name='yolo11s-seg.pt'))
        thread_manager.register("mediapipe", MediaPipeThread())
        thread_manager.register("udp", UdpThread(bind_ip="0.0.0.0", port_left=5005, port_right=5006))

        # 비동기 터치 분석 실행
        from workers.fusion_module.fusion_worker import FusionTask
        fusion_loop = FusionTask()
        asyncio.create_task(fusion_loop.run())
        # from event_generator import KeyboardQWThread
        # kb = KeyboardQWThread()
        # kb.start()

        yield  # 앱이 실행되는 동안 여기서 대기
        
        print("📴 Signal received, shutting down gracefully...")
        status_manager.running = False
        thread_manager.wake_all()

    # FastAPI 앱 생성
    app = FastAPI(lifespan=lifespan)
    
    # CORS 설정 추가
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 라우터 연결
    app.include_router(status_router.router, prefix="/api/status")
    app.include_router(object_router.router, prefix="/api/object")
    app.include_router(loop_router.router, prefix="/api/loop")
    app.include_router(websocket_router.router, prefix="/ws")

    return app

# 🔥 FastAPI 앱 실행
if __name__ == "__main__":

    app = create_app()

    uvicorn.run(app, host="0.0.0.0", port=8000)
