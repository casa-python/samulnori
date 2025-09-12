# keyboard_qw_thread.py
import threading
import time
from utils.sound_engine import sound_engine
from managers.queue_manager import queue_manager
from managers.object_manager import object_manager

try:
    import msvcrt  # Windows 전용
    _HAS_MSVCRT = True
except ImportError:
    _HAS_MSVCRT = False


class KeyboardQWThread:
    """
    q / w 키를 누르면 'on' 이벤트 발생
    - on_q(), on_w() 메서드 내장 (필요 시 오버라이드하거나 그대로 사용 가능)
    - ESC 누르면 스레드 종료
    """

    def __init__(self, min_interval: float = 0.04):
        self.min_interval = min_interval
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._last_ts = {"q": 0.0, "w": 0.0}

        self.kick = sound_engine.load_sound("C:\\Users\\SSAFY\\Desktop\\workspace\\S13P11A108\\backend\\samples\\TS_NIR_Z_JJ_kick_one_shot_rock_god_hard.wav")
        self.snare = sound_engine.load_sound("C:\\Users\\SSAFY\\Desktop\\workspace\\S13P11A108\\backend\\samples\\TS_NIR_Z_JJ_snare_one_shot_hi_shorty_med.wav")

    def start(self):
        if not _HAS_MSVCRT:
            raise RuntimeError("KeyboardQWThread는 Windows 콘솔(msvcrt)에서만 동작합니다.")
        self._thread.start()

    def stop(self):
        self._stop.set()

    def join(self, timeout=None):
        self._thread.join(timeout)

    # --------- 이벤트 핸들러 (네가 여기다가 사운드 로직 넣으면 됨) ---------
    def on_q(self, event: dict):
        print(f"[event] Q pressed @ {event['timestamp']:.6f}")
        queue_manager.async_left_glove_queue.put({
            "type": "on",
            "hand": "left",
            "sensor_idx": 1,
            "velocity": 1.0,
        })
        # id_list = list(object_manager.get_snapshot().keys())
        # for obj_id in id_list:
        #     event = {
        #         "type": "on",
        #         "hand": "left",
        #         "sensor_idx": 1,
        #         "velocity": 1.0,
        #     }
        #     object_manager.handle_touch_event(obj_id, event)
        #     event = {
        #         "type": "on",
        #         "hand": "right",
        #         "sensor_idx": 1,
        #         "velocity": 1.0,
        #     }
        #     object_manager.handle_touch_event(obj_id, event)
        # self.kick.play()
        # time.sleep(0.001)
        # self.kick.play()
        # self.kick.play()
        # time.sleep(0.001)
        # self.kick.play()
        # self.kick.play()
        # time.sleep(0.001)
        # self.kick.play()
        # self.snare.play()
        # time.sleep(0.001)
        # self.snare.play()
        # time.sleep(0.001)
        # self.snare.play()


    def on_w(self, event: dict):
        print(f"[event] W pressed @ {event['timestamp']:.6f}")
        queue_manager.async_left_glove_queue.put({
            "type": "on",
            "hand": "right",
            "sensor_idx": 1,
            "velocity": 1.0,
        })
        # self.snare.play()
        # self.snare.play()
        # self.snare.play()

    # ---------------- 내부 ----------------
    def _emit(self, key: str):
        now = time.time()
        if now - self._last_ts[key] < self.min_interval:
            return
        self._last_ts[key] = now

        event = {
            "type": "on",
            "key": key,
            "timestamp": now,
        }
        if key == "q":
            self.on_q(event)
        elif key == "w":
            self.on_w(event)

    def _run(self):
        print("[KeyboardQWThread] started (q/w = ON event, ESC = stop)")
        try:
            while not self._stop.is_set():
                if msvcrt.kbhit():
                    ch = msvcrt.getwch()
                    if ch == "\x1b":  # ESC
                        print("[KeyboardQWThread] ESC pressed -> stopping")
                        self.stop()
                        break
                    if ch.lower() == "q":
                        self._emit("q")
                    elif ch.lower() == "w":
                        self._emit("w")
                time.sleep(0.002)
        finally:
            print("[KeyboardQWThread] stopped")
