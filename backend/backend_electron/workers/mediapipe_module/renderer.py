import threading
import time
import cv2
import queue

from managers.queue_manager import PeekableQueue
from managers.status_manager import status_manager

class RenderThread:
    def __init__(
            self,
            frame_queue: PeekableQueue,
            sync_hand_queue: PeekableQueue,
            stream_queue: PeekableQueue,
            max_fps=30
        ):
        self.frame_queue = frame_queue
        self.sync_hand_queue = sync_hand_queue
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
                frame = self.frame_queue.peek_latest()
                hand_data = self.sync_hand_queue.peek_latest()
            except queue.Empty:
                continue

            try:
                for hand in hand_data["hands"]:
                    for lm in hand["landmarks"]:
                        cx = int(lm["x"] * frame.shape[1])
                        cy = int(lm["y"] * frame.shape[0])
                        cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)
            except Exception as e:
                print(f"[MediaPipeRendererThread] 렌더링 중 오류 발생: {e}")
            
            elapsed = time.time() - start_time
            sleep_time = self.delay - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
        
    def wake(self):
        with self.cond:
            self.cond.notify()