import asyncio
from typing import List, Dict, Any, List
from queue import Empty
from managers.status_manager import status_manager
from managers.queue_manager import queue_manager
from managers.object_manager import object_manager
from managers.loop_manager import loop_manager
from managers.queue_manager import PeekableQueue, SharedAsyncQueue
from workers.fusion_module.touch_processor import TouchProcessor
from workers.fusion_module.object_mapper import ObjectTouchMapper
from workers.fusion_module.object_binder import ObjectBinder

from utils.sound_engine import SoundEngine, Sound

TYPE_COLOR = {
    "on":   (60, 220, 120),
    "off":  (90, 90, 230),
    "aftertouch": (180, 180, 180),
}

class FusionTask:
    def __init__(self):
        self.left_hand_queue: PeekableQueue = queue_manager.sync_left_hand_queue
        self.right_hand_queue: PeekableQueue = queue_manager.sync_right_hand_queue
        self.left_glove_queue: SharedAsyncQueue = queue_manager.async_left_glove_queue
        self.right_glove_queue: SharedAsyncQueue = queue_manager.async_right_glove_queue
        self.async_event_queue: SharedAsyncQueue = queue_manager.async_event_queue

        self._running = False
        self._tasks: List[asyncio.Task] = []
        self.touch_processor = TouchProcessor()
        self.mapper = ObjectTouchMapper()
        self.binder = ObjectBinder()

    async def run(self):
        self._running = True
        self._tasks = [
            asyncio.create_task(self._hand_loop("left", self.left_hand_queue, self.left_glove_queue)),
            asyncio.create_task(self._hand_loop("right", self.right_hand_queue, self.right_glove_queue)),
        ]
        try:
            await asyncio.gather(*self._tasks)
        except asyncio.CancelledError:
            for t in self._tasks: t.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
            raise
        finally:
            self._tasks.clear()
            self._running = False
    
    async def stop(self):
        self._running = False
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
    
    async def _hand_loop(self, hand: str, hand_queue: PeekableQueue, glove_queue: SharedAsyncQueue):
        while self._running and status_manager.running:
            glove_packet = await glove_queue.get_latest()
            values = glove_packet.get("values")
            timestamp = glove_packet.get("timestamp")
            events = self.touch_processor.update(hand, values, timestamp)
            if not events:
                continue
            
            for ev in events:
                print(ev, flush=True)
                    
            try:
                hand_packet = hand_queue.peek_latest()
            except Empty:
                print("Empty hand queue")
                continue

            # 손 랜드마크 꺼내기
            landmarks = hand_packet.get("landmarks")

            # Object 최신 스냅샷
            obj_map: Dict[int, Any] = object_manager.get_snapshot()

            # object mapping
            mapped_events = self.mapper.map_events_to_objects(events, landmarks, obj_map)

            # object binding (sticky)
            bound_events = self.binder.annotate_mapped_events(mapped_events)

            for event in bound_events:
                obj_id = event.get("object_id")
                if obj_id is None:
                    continue
                object_manager.handle_touch_event(obj_id, event)
            
            self.async_event_queue.put_from_thread(bound_events)

