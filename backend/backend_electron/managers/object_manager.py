from enum import Enum
import time
from typing import Optional, Dict, Tuple, List, Any

from utils.sound_engine import sound_engine as engine, Sound
from managers.loop_manager import loop_manager

class SoundMapping:
    Key = Tuple[str, int]

    def __init__(self):
        self.sounds: Dict[SoundMapping.Key, Sound] = {}

    # --- 매핑 관리 ---
    def set(self, hand: str, sensor_idx: int, sound: Sound) -> None:
        self.sounds[(hand, int(sensor_idx))] = sound

    def unset(self, hand: str, sensor_idx: int) -> None:
        self.sounds.pop((hand, int(sensor_idx)), None)

    def clear(self) -> None:
        self.sounds.clear()

    # 이벤트 처리 (ONESHOT 전용)
    def handle_event(self, event: Dict[str, Any]) -> None:
        """
        events 예:
          {"type": "on"/"off", "hand": "left"/"right", "sensor_idx": int, "velocity": float, ...}
        - on: 즉시 oneshot 발사
        - off: 무시
        """
        if event.get("type") != "on":
            return
        hand = event.get("hand")
        idx = event.get("sensor_idx")
        if hand is None or idx is None:
            return

        key = (str(hand), int(idx))
        snd = self.sounds.get(key)
        if snd:
            snd.play()
            try:
                loop_manager.add_sound_event_to_current(sound=snd)
            except Exception as e:
                print(f"[SoundMapping] 루프에 사운드 이벤트 추가 실패: {e}")
                
    def dump(self) -> List[Dict[str, Any]]:  # 조회 시 path + volume 제공
        out: List[Dict[str, Any]] = []
        for (hand, idx), snd in self.sounds.items():
            path = getattr(snd, "path", None)
            out.append({
                "hand": hand,
                "sensor_idx": int(idx),
                "path": path,
                "volume": float(getattr(snd, "volume", 1.0)),
            })
        return out


class Object:
    def __init__(
            self, 
            object_id: int, 
            class_name: str = None, 
            confidence: float = 0.0, 
            segmentation: Optional[List[List[float]]] = None,
            tlwh: Optional[List[float]] = None,
            min_visibility_ratio: float = 0.95, 
            max_growth_ratio: float = 3.0, 
            occluded_tolerance: int = 15
        ):
        self.id = object_id
        self.class_name = class_name
        self.confidence = confidence
        self.segmentation = segmentation  # 예: [[x1, y1], [x2, y2], ...]
        self.tlwh = tlwh  # 예: [x, y, w, h]
        self._version = 0

        # --- 면적 기반 업데이트 제어 파라미터 ---
        self._base_area: Optional[float] = None
        self._min_visibility_ratio = float(min_visibility_ratio)   # 새면적 / 기준면적 < 이 값이면 보류
        self._max_growth_ratio = float(max_growth_ratio)           # 너무 커지는 것도 비정상치로 보류(옵션)
        self._occluded_streak = 0
        self._occluded_tolerance = int(occluded_tolerance)         # 연속 보류 허용 횟수
        
        self._mapping = SoundMapping()
        
    # ------- 여기부터: 매핑용 진입점 (path 직접 사용) -------
    def set_mapping_path(self, hand: str, sensor_idx: int, path: str, volume: float = 1.0):
        sound = engine.load_sound(path, volume=float(volume))  # Sound
        self._mapping.set(hand, sensor_idx, sound)

    def set_mapping_volume(self, hand: str, sensor_idx: int, volume: float):
        # 기존 매핑된 Sound의 볼륨만 갱신하고 싶을 때 사용(선택)
        snd = self._mapping.sounds.get((hand, int(sensor_idx)))
        if not snd:
            raise KeyError(f"mapping not found: ({hand}, {sensor_idx})")
        snd.set_volume(float(volume))

    def unset_mapping(self, hand: str, sensor_idx: int) -> None:
        self._mapping.unset(hand, sensor_idx)

    def clear_mappings(self) -> None:
        self._mapping.clear()

    def handle_touch_event(self, event: Dict[str, Any]) -> None:
        self._mapping.handle_event(event)

    def get_mappings(self) -> List[Dict[str, Any]]:
        return self._mapping.dump()
    # ------------------------------------------------------

    @staticmethod
    def _poly_area(points):
        if not points or len(points) < 3:
            return 0.0
        area = 0.0
        n = len(points)
        for i in range(n):
            x1, y1 = points[i]
            x2, y2 = points[(i + 1) % n]
            area += x1 * y2 - x2 * y1
        return abs(area) * 0.5
    
    def validate_update(self, segmentation=None, tlwh=None):
        if segmentation is None:
            return False, 0.0  # 최소한 seg는 있어야 면적 판단 가능(필요시 정책 조정)

        new_area = self._poly_area(segmentation)
        if new_area <= 0.0:
            self._occluded_streak += 1
            if self._base_area and self._occluded_streak >= self._occluded_tolerance:
                self._base_area *= 0.9
                self._occluded_streak = 0
            return False, 0.0

        # 아직 기준 없으면 이번 프레임을 기준으로 삼고 수용
        if self._base_area is None:
            self._base_area = new_area
            self._occluded_streak = 0
            return True, new_area

        visible_ratio = new_area / (self._base_area if self._base_area > 0 else 1.0)

        # 너무 작아진 경우(가림 의심)
        if visible_ratio < self._min_visibility_ratio:
            self._occluded_streak += 1
            if self._occluded_streak >= self._occluded_tolerance:
                self._base_area *= 0.97  # 복귀 유도
                self._occluded_streak = 0
            return False, 0.0

        # 너무 커진 경우(점프/오매칭 의심)
        if visible_ratio > self._max_growth_ratio:
            self._occluded_streak += 1
            # 필요하면 여기서 완화 로직 추가 가능
            return False, 0.0

        # 통과
        self._occluded_streak = 0
        return True, new_area
        
    def update_tracking_info(self, class_name=None, confidence=None, segmentation=None, tlwh=None):
        ok, new_area = self.validate_update(segmentation, tlwh)
        if not ok:
            return False

        # 수용: 상태 반영 + 버전 업
        self.class_name = class_name
        self.confidence = confidence
        self.segmentation = segmentation
        self.tlwh = tlwh
        self._version += 1

        # 기준면적은 서서히 업데이트
        alpha = 0.1
        self._base_area = (1 - alpha) * self._base_area + alpha * new_area
        self._occluded_streak = 0
        return True

class ObjectManager:
    def __init__(self):
        self.objects: Dict[int, Object] = {}

    def add_object(self, object_id, segmentation=None, tlwh=None) -> None:
        if object_id not in self.objects:
            self.objects[object_id] = Object(object_id, segmentation, tlwh)

    def remove_object(self, object_id: int) -> None:
        self.objects.pop(object_id, None)
    
    def is_empty(self) -> bool:
        return not self.objects
        
    def get_object_ids(self) -> List[int]:
        return list(self.objects.keys())

    def get_snapshot(self) -> Dict[int, Object]:
        return dict(self.objects)

    def get_flat_snapshot(self) -> Dict[int, Dict[str, Any]]:
        out: Dict[int, Dict[str, Any]] = {}
        for oid, obj in self.objects.items():
            # tlwh 복사
            tlwh_copy: Optional[List[float]] = list(obj.tlwh) if obj.tlwh is not None else None
            # segmentation 복사/정규화
            if obj.segmentation:
                seg_copy: List[List[float]] = [[float(x), float(y)] for x, y in obj.segmentation]
            else:
                seg_copy = None

            out[oid] = {
                "class_name": obj.class_name,
                "confidence": float(obj.confidence) if obj.confidence is not None else None,
                "tlwh": tlwh_copy,
                "segmentation": seg_copy
            }
        return out

    def update_tracking_infos(self, tracking_data: Dict[int, Dict[str, Any]]) -> None:
        for obj_id, obj in self.objects.items():
            if obj_id in tracking_data:
                data = tracking_data[obj_id]
                obj.update_tracking_info(
                    class_name=data.get("class_name"),
                    confidence=data.get("confidence"),
                    segmentation=data.get("segmentation"),
                    tlwh=data.get("tlwh"),
                )

    # ------- 여기부터: 매핑용 진입점 (path 직접 사용) -------
    def set_mapping_by_path(self, object_id: int, hand: str, sensor_idx: int, path: str, volume: float) -> int:
        obj = self.objects.get(object_id)
        return obj.set_mapping_path(hand, sensor_idx, path, volume)
    
    def set_mapping_volume(self, object_id: int, hand: str, sensor_idx: int, volume: float) -> None:
        obj = self.objects.get(object_id)
        if not obj:
            raise KeyError(f"Object {object_id} not found")
        obj.set_mapping_volume(hand, sensor_idx, volume)

    def unset_mapping(self, object_id: int, hand: str, sensor_idx: int) -> None:
        obj = self.objects.get(object_id)
        if not obj:
            raise KeyError(f"Object {object_id} not found")
        obj.unset_mapping(hand, sensor_idx)

    def clear_mappings(self, object_id: int) -> None:
        obj = self.objects.get(object_id)
        if not obj:
            raise KeyError(f"Object {object_id} not found")
        obj.clear_mappings()

    def bulk_set_mappings_by_path(self, object_id: int, mappings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        mappings: [{hand, sensor_idx, path, volume}, ...]
        """
        results = []
        for m in mappings:
            try:
                hand = m.get("hand")
                idx = m.get("sensor_idx")
                path = m.get("path")
                volume = m.get("volume", 1.0)

                if hand not in ("left", "right"):
                    raise ValueError("hand must be 'left' or 'right'")
                if not isinstance(idx, int):
                    raise ValueError("sensor_idx must be int")
                if not isinstance(path, str) or not path.strip():
                    raise ValueError("path must be non-empty string")
                if path == "null":
                    self.unset_mapping(object_id, hand, idx)
                try:
                    volume = float(volume)
                    if not (0.0 <= volume <= 2.0):
                        raise ValueError
                except Exception:
                    raise ValueError("volume must be a float between 0.0 and 2.0")

                self.set_mapping_by_path(object_id, hand, idx, path, volume)
                results.append({"hand": hand, "sensor_idx": idx, "path": path, "status": "ok"})
            except Exception as e:
                results.append({
                    "hand": m.get("hand"),
                    "sensor_idx": m.get("sensor_idx"),
                    "path": m.get("path"),
                    "volume": m.get("volume"),
                    "status": "error",
                    "reason": str(e)
                })
        return results
    
    def get_mappings(self, object_id: int) -> List[Dict[str, Any]]:
        obj = self.objects.get(object_id)
        if not obj:
            raise KeyError(f"Object {object_id} not found")
        return obj.get_mappings()
    # ------------------------------------------------------

    # 단일 이벤트
    def handle_touch_event(self, object_id: int, event: Dict[str, Any]) -> bool:
        obj = self.objects.get(object_id)
        if not obj:
            print(f"Object {object_id} Not Found!")
            return False
        obj.handle_touch_event(event)
        return True

object_manager = ObjectManager()