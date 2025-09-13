import threading
import cv2
import time
from managers.queue_manager import PeekableQueue
from managers.status_manager import status_manager
from managers.queue_manager import queue_manager

class WebcamThread:
    def __init__(self, src=0):
        self.frame_queue: PeekableQueue = queue_manager.frame_queue
        self.src = src
        self.cap = None
        self.cond = threading.Condition()
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _open_cam(self):
        if self.cap is None:
            cap = cv2.VideoCapture(self.src)
            if not cap.isOpened():
                return False
            self.cap = cap
        return True

    def _release_cam(self):
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

    def _capture_loop(self):
        while status_manager.running:
            with self.cond:
                while not status_manager.webcam_on and status_manager.running:
                    self._release_cam()
                    self.cond.wait()  # 활성화될 때까지 블로킹 (CPU 0%)
                if not status_manager.running:
                    break

            # 카메라 오픈 시도 (재시도 포함)
            if not self._open_cam():
                # 실패 시 약간 쉬고 재시도
                time.sleep(0.2)
                continue

            # 프레임 읽기
            ret, frame = self.cap.read()
            if ret:
                self.frame_queue.put({
                    "frame": frame,
                    "timestamp": time.perf_counter()
                })

        # 종료 시 정리
        self._release_cam()

    def wake(self):
        """status_manager 플래그가 바뀐 후 이 메서드로 스레드 깨워야 함"""
        with self.cond:
            self.cond.notify()
