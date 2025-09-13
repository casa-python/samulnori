from threading import Lock

class StatusManager:
    def __init__(self):
        self._lock = Lock()

        # 상태
        self.running = True
        self.webcam_on = False
        self.glove_on = False
        self.yolo_on = False
        self.mediapipe_on = False
        self.streaming = False

status_manager = StatusManager()