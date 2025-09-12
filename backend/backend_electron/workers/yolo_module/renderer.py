import threading
import time
from queue import Queue, Empty
from managers.status_manager import status_manager

class RenderThread:
    def __init__(self, yolo_queue: Queue, stream_queue: Queue, max_fps=30):
        self.yolo_queue = yolo_queue
        self.stream_queue = stream_queue

        self.cond = threading.Condition()
        self.max_fps = max_fps
        self.delay = 1.0 / max_fps if max_fps > 0 else 0

        self.thread = threading.Thread(target=self._render_loop, daemon=True)
        self.thread.start()

    def _render_loop(self):
        while status_manager.running:
            with self.cond:
                while not status_manager.streaming and status_manager.running:
                    self.cond.wait()
                if not status_manager.running:
                    break

            start_time = time.time()

            try:
                results = self.yolo_queue.get(timeout=1)
            except Empty:
                continue

            try:
                # YOLO 결과 시각화
                annotated_frame = results.plot()
                self.stream_queue.put(annotated_frame)
            except Exception as e:
                print(f"[YoloRendererThread] 렌더링 중 오류 발생: {e}")

            elapsed = time.time() - start_time
            sleep_time = self.delay - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def wake(self):
        """status_manager.streaming이 바뀐 후 이 메서드로 스레드 깨워야 함"""
        with self.cond:
            self.cond.notify()
