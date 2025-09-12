import time
import threading
import struct
import socket
import select

from managers.status_manager import status_manager
from managers.queue_manager import queue_manager
from managers.queue_manager import SharedAsyncQueue

# 16B: uint32(ts_us) + 6 * uint16
FMT = "<I6H"
PKT_SIZE = struct.calcsize(FMT)  # 16

class UdpThread:
    def __init__(self, bind_ip="0.0.0.0", port_left=5005, port_right=5006):
        self.left_queue: SharedAsyncQueue  = queue_manager.async_left_glove_queue
        self.right_queue: SharedAsyncQueue = queue_manager.async_right_glove_queue

        self.bind_ip    = bind_ip
        self.port_left  = port_left
        self.port_right = port_right

        self.sock_left  = None
        self.sock_right = None

        self.prev_ts32  = 0
        self.prev_host  = 0

        self.enabled    = bool(status_manager.glove_on)
        self.stop_evt   = threading.Event()

        self.cond = threading.Condition()
        self.thread = threading.Thread(target=self._receive_loop, daemon=True)
        self.thread.start()

    def _mk_sock(self, port: int) -> socket.socket:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1 << 20)  # 여유 버퍼 (환경 따라 무시될 수 있음)
        except OSError:
            pass
        s.bind((self.bind_ip, port))
        s.setblocking(False)
        return s
    
    def _open_sockets(self):
        if self.sock_left is None:
            self.sock_left = self._mk_sock(self.port_left)
        if self.sock_right is None:
            self.sock_right = self._mk_sock(self.port_right)

    def _close_sockets(self):
        for s in (self.sock_left, self.sock_right):
            try:
                if s: s.close()
            except Exception:
                pass
        self.sock_left = self.sock_right = None

    def _receive_loop(self):
        while status_manager.running:
            # ----- 대기 구간 (glove_on이 켜질 때까지 완전 수면) -----
            with self.cond:
                while (not status_manager.glove_on) and status_manager.running:
                    self._close_sockets()   # 자원 정리
                    self.cond.wait()        # ★ 깨어날 때까지 블록 (CPU 0%)
                if not status_manager.running:
                    break

            # ----- 활성화: 소켓 열고 수신 루프 -----
            self._open_sockets()
            socks = [self.sock_left, self.sock_right]

            try:
                rlist, _, _ = select.select(socks, [], [], 0.1)
            except (OSError, ValueError):
                # 소켓이 닫히는 타이밍 등
                break

            now = time.perf_counter()
            for s in rlist:
                hand = "left" if s is self.sock_left else "right"
                try:
                    data, addr = s.recvfrom(64)
                except (BlockingIOError, OSError):
                    continue
                if len(data) < PKT_SIZE:
                    continue

                try:
                    ts32, *raw_vals = struct.unpack(FMT, data[:PKT_SIZE])
                except struct.error:
                    continue

                # (디버그) 호스트 수신 간격
                # prev_host = self.prev_host
                # if prev_host:
                #     delta_host_ms = (now - prev_host) * 1000.0
                #     print(f"[UDP {hand}] host Δ{delta_host_ms:.3f} ms")
                # self.prev_host = now

                # (선택) 보드 내부 주기 확인
                # prev_ts32 = self.prev_ts32
                # if prev_ts32 is not None:
                #     delta_esp_ms = ((ts32 - prev_ts32) & 0xFFFFFFFF) / 1000.0
                #     print(f"[UDP {hand}] esp  Δ{delta_esp_ms:.3f} ms")
                # self.prev_ts32 = ts32

                # 값 변환 + placeholder 0 유지(기존 구조 호환)
                fsr_values = [4095 - v for v in raw_vals] + [0]

                q = self.left_queue if hand == "left" else self.right_queue
                if not status_manager.running:
                    continue
                q.put_from_thread({
                    "values": fsr_values,
                    "timestamp": ts32 / 1_000_000.0,
                })

        # 종료 시 정리
        self._close_sockets()

    def wake(self):
        """status_manager 플래그 변경 후 호출 (webcam 패턴과 동일)"""
        with self.cond:
            self.cond.notify()