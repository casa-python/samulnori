import threading
import cv2
from managers.queue_manager import PeekableQueue, SharedAsyncQueue
from managers.status_manager import status_manager
from managers.queue_manager import queue_manager

class JpegEncoderThread:
    def __init__(self, quality=80):
        self.frame_queue: PeekableQueue = queue_manager.frame_queue
        self.async_jpeg_queue: SharedAsyncQueue = queue_manager.async_jpeg_queue

        self.cond = threading.Condition()
        self.quality = quality

        self.thread = threading.Thread(target=self._encode_loop, daemon=True)
        self.thread.start()

    def _encode_loop(self):
        last_ver = 0
        while status_manager.running:
            with self.cond:
                while not status_manager.streaming and status_manager.running:
                    self.cond.wait()
                if not status_manager.running:
                    break
            
            data, last_ver = self.frame_queue.peek_latest_blocking(last_ver, timeout=1.0)
            if not data:
                continue
            frame, timestamp = data["frame"], data["timestamp"]

            try:
                success, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), self.quality])
                if success:
                    self.async_jpeg_queue.put_from_thread(encoded.tobytes())
            except Exception as e:
                print(f"[JpegEncoderThread] JPEG 인코딩 중 오류 발생: {e}")

    def wake(self):
        """status_manager.streaming이 바뀐 후 이 메서드로 스레드 깨워야 함"""
        with self.cond:
            self.cond.notify()
