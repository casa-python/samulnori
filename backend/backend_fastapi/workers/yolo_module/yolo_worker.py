import threading
import os
import torch
from ultralytics import YOLO

from managers.queue_manager import PeekableQueue, SharedAsyncQueue
from managers.status_manager import status_manager
from managers.queue_manager import queue_manager
from managers.object_manager import object_manager

class YoloThread:
    def __init__(self, model_name='yolo11s-seg.pt'):
        self.frame_queue: PeekableQueue = queue_manager.frame_queue
        self.async_object_queue: SharedAsyncQueue = queue_manager.async_object_queue

        # YOLO 모델 로드
        model_path = os.path.join(os.path.dirname(__file__), 'models', model_name)
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"Using device: {device}")
        self.model = YOLO(model_path).to(device=device)
        # 트래커 경로 준비
        self.tracker_path = os.path.join(os.path.dirname(__file__), 'tracker.yaml')
        
        self.cond = threading.Condition()
        self.thread = threading.Thread(target=self._inference_loop, daemon=True)
        self.thread.start()

    def _inference_loop(self):
        last_ver = 0
        while status_manager.running:
            with self.cond:
                while not status_manager.yolo_on and status_manager.running:
                    self.cond.wait()
                if not status_manager.running:
                    break
            
            data, last_ver = self.frame_queue.peek_latest_blocking(last_ver, timeout=1.0)
            if not data:
                continue
            frame, timestamp = data["frame"], data["timestamp"]

            # YOLOv8 추론 + 트래킹
            try:
                results_list = self.model.track(
                    source=frame,
                    persist=True,
                    stream=False,  # stream=False로 단일 프레임 처리
                    tracker=self.tracker_path,
                    verbose=False
                )
                # 가끔 빈 리스트가 올 수 있음
                if not results_list:
                    continue

                results = results_list[0]
                parsed_results = self._parse_results(results) # 조건에 맞는 객체 추출 및 파싱 (현재는 clingy)

                # 초기화(물체 추가) 전
                if object_manager.is_empty():
                    self.async_object_queue.put_from_thread({
                        "objects": parsed_results,
                        "timestamp": timestamp
                    })
                else:
                    # Selected Objects 좌표 업데이트
                    object_manager.update_tracking_infos(parsed_results)
                    if status_manager.streaming:
                        self.async_object_queue.put_from_thread({
                            "objects": object_manager.get_flat_snapshot(),
                            "timestamp": timestamp
                        })


            except Exception as e:
                print(f"[YOLOThread] 추론 중 오류 발생: {e}")
    
    def _parse_results(self, results):
        objects = {}
        names = results.names

        has_masks = results.masks is not None and results.masks.xy is not None
        if not has_masks or results.boxes.id is None:
            return objects

        # tracked_stracks에서 clingy == True인 애들만
        tracker = self.model.predictor.trackers[0]
        clingy_ids = {track.track_id for track in tracker.tracked_stracks if getattr(track, "clingy", False)}
        track_map = {t.track_id: t for t in tracker.tracked_stracks}
        
        # YOLO 결과에서 해당 track_id와 일치하는 애들만 필터링
        ids = results.boxes.id.cpu().numpy().astype(int)
        classes = results.boxes.cls.cpu().numpy().astype(int)
        confs = results.boxes.conf.cpu().numpy()
        segmentations = results.masks.xy

        for i, obj_id in enumerate(ids):
            if obj_id not in clingy_ids:
                continue

            class_id = int(classes[i])
            confidence = float(confs[i])
            segmentation = [[float(x), float(y)] for [x, y] in segmentations[i]]
            track = track_map.get(obj_id)
            tlwh = track.tlwh if track else None

            obj = {
                "class_name": names[class_id],
                "confidence": round(confidence, 3),
                "segmentation": segmentation,
                "tlwh": list(map(float, tlwh)) if tlwh is not None else None
            }
            objects[int(obj_id)] = obj

        return objects

    def wake(self):
        """status_manager 플래그가 바뀐 후 이 메서드로 스레드 깨워야 함"""
        with self.cond:
            self.cond.notify()