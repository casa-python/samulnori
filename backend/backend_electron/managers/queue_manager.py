
"""
아래는 커스텀 자료구조들

PeekableQueue
- Deque 기반 크기 유지하는 동기 큐
- 최신 프레임을 copy해서 리턴하는 peek_latest 구현함으로써 여러 스레드에서 공유 가능하도록 함
- get_latest를 활용하면 공유하지 않는 경우에도 사용 가능함.

SharedAsyncQueue
- 크기 유지하는 비동기 큐
"""

from collections import deque
import threading
import queue

class PeekableQueue:
    def __init__(self, maxsize=1):
        self.queue = deque(maxlen=maxsize)
        self.lock = threading.Lock()

        self.cond = threading.Condition(self.lock)
        self._ver = 0
        self._stopped = False

    def put(self, item):
        with self.cond:
            self.queue.append(item)  # maxlen 지정하면 오래된 항목 자동 삭제
            self._ver += 1
            self.cond.notify()  # NEW: 대기 중 컨슈머들 깨우기

    def peek_latest(self):
        with self.lock:
            if self.queue:
                return self.queue[-1].copy()
            raise queue.Empty

    def get_latest_and_clear(self):
        with self.lock:
            if not self.queue:
                raise queue.Empty()  # 표준 큐와 동일하게 예외 발생
            latest = None
            while self.queue:
                latest = self.queue.pop()
            return latest
        
    # --- NEW: 블로킹으로 최신값 받기(브로드캐스트, 비파괴) ---
    def peek_latest_blocking(self, last_ver=0, timeout=None):
        with self.cond:
            self.cond.wait_for(lambda: self._ver > last_ver or self._stopped, timeout)
            if self._stopped or not self.queue:
                return None, last_ver
            return self.queue[-1], self._ver

import asyncio
from typing import Optional

class SharedAsyncQueue:
    def __init__(self, loop: Optional[asyncio.AbstractEventLoop] = None, maxsize=1):
        self.queue = asyncio.Queue(maxsize=maxsize)
        self.loop = loop or asyncio.get_event_loop()

    async def put(self, item):
        """비동기 루프 내에서 직접 사용하는 put"""
        if self.queue.full():
            try:
                _ = self.queue.get_nowait()  # 오래된 것 버림
                self.queue.task_done()
            except asyncio.QueueEmpty:
                pass
        await self.queue.put(item)
        
    def put_from_thread(self, item):
        """스레드에서 안전하게 호출 가능한 put"""
        def _put():
            asyncio.create_task(self.put(item))
        self.loop.call_soon_threadsafe(_put)

    async def get_latest(self):
        """큐 비우고 가장 마지막 것만 반환"""
        latest = await self.queue.get()
        while not self.queue.empty():
            try:
                latest = self.queue.get_nowait()
                self.queue.task_done()
            except asyncio.QueueEmpty:
                break
        return latest

    def empty(self):
        return self.queue.empty()

    def full(self):
        return self.queue.full()

    async def clear(self):
        while not self.queue.empty():
            try:
                _ = self.queue.get_nowait()
                self.queue.task_done()
            except asyncio.QueueEmpty:
                break

            
class QueueManager:
    def __init__(self):
        self.frame_queue = PeekableQueue(maxsize=1)
        # self.yolo_queue = SharedQueue(maxsize=5) # YOLO raw result 렌더링용이므로 사용 X
        # self.render_queue = SharedQueue(maxsize=5) # 현재는 프론트에서 렌더링하므로 사용 X

        # frame_queue를 인풋으로 받는 큐들
        self.sync_left_hand_queue = PeekableQueue(maxsize=1) # 왼손 인식
        self.sync_right_hand_queue = PeekableQueue(maxsize=1) # 오른손 인식

        # 프론트 전송용 비동기 큐
        # 비워두고 나중에 loop 주입!
        self.async_object_queue = None
        self.async_hand_queue = None
        self.async_jpeg_queue = None
        self.async_event_queue = None

        # 장갑 센서 수신용 비동기 큐
        self.async_left_glove_queue = None
        self.async_right_glove_queue = None
    
    def initialize_async_queues(self, loop):
        self.async_object_queue = SharedAsyncQueue(loop=loop, maxsize=1)
        self.async_hand_queue = SharedAsyncQueue(loop=loop, maxsize=1)
        self.async_jpeg_queue = SharedAsyncQueue(loop=loop, maxsize=1)
        self.async_event_queue = SharedAsyncQueue(loop=loop, maxsize=1)
        self.async_left_glove_queue = SharedAsyncQueue(loop=loop, maxsize=1)
        self.async_right_glove_queue = SharedAsyncQueue(loop=loop, maxsize=1)

    
queue_manager = QueueManager()
