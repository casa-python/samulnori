from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import Point, Polygon
from shapely.prepared import prep

class ObjectTouchMapper:
    """랜드마크 좌표 → object_id 매핑 전담 (bbox → polygon covers)"""

    def __init__(self):
        # 폴리곤 캐시 (준비 폴리곤 + 면적 + 버전)
        self._poly_cache: Dict[int, Any] = {}
        self._poly_area: Dict[int, float] = {}
        self._poly_ver: Dict[int, int] = {}

    @staticmethod
    def _in_tlwh(px: float, py: float, tlwh) -> bool:
        x, y, w, h = tlwh
        return (x <= px <= x + w) and (y <= py <= y + h)

    def collect_bbox_candidates(self, px: float, py: float, obj_map: Dict[int, Any]) -> List[int]:
        cands: List[tuple[int, float]] = []
        for oid, obj in obj_map.items():
            tlwh = getattr(obj, "tlwh", None)
            if not tlwh or len(tlwh) != 4:
                continue
            if self._in_tlwh(px, py, tlwh):
                _, _, w, h = tlwh
                cands.append((oid, float(w * h)))
        cands.sort(key=lambda x: x[1])
        return [oid for oid, _ in cands]

    def _get_prepared_poly(self, oid: int, obj) -> Tuple[Optional[Any], Optional[float]]:
        seg = getattr(obj, "segmentation", None)
        if not seg or len(seg) < 3:
            return None, None

        cur_ver = getattr(obj, "_version", None)
        cached_ver = self._poly_ver.get(oid)
        poly = self._poly_cache.get(oid)

        if (poly is None) or (cached_ver != cur_ver):
            try:
                p = Polygon(seg)
                if not (p.is_valid and not p.is_empty):
                    return None, None
                poly = prep(p)
                self._poly_cache[oid] = poly
                self._poly_area[oid] = float(p.area)
                self._poly_ver[oid] = cur_ver
            except Exception:
                return None, None
        return poly, self._poly_area.get(oid)

    def pick_best_object(self, px: float, py: float, obj_map: Dict[int, Any]) -> Optional[int]:
        cands = self.collect_bbox_candidates(px, py, obj_map)
        if not cands:
            return None
        if len(cands) == 1:
            return cands[0]

        pt = Point(px, py)
        best_oid: Optional[int] = None
        best_area = float("inf")
        for oid in cands:
            obj = obj_map.get(oid)
            if not obj:
                continue
            poly, area = self._get_prepared_poly(oid, obj)
            if poly is None:
                continue
            if poly.covers(pt):
                if area is not None and area < best_area:
                    best_area = area
                    best_oid = oid
        return best_oid if best_oid is not None else cands[0]
    
    def map_events_to_objects(
        self,
        events: List[Dict[str, Any]],
        lms: List[List],
        obj_map: Dict[int, Any]
    ) -> List[Dict[str, Any]]:
        """
        events: [{"type": "on"/"off", "hand": "left"/"right", "sensor_idx": int, ...}, ...]
        mp_packet: mediapipe에서 받은 hands 패킷
        obj_map: object_manager.get_state()[1] 형태
        return: events에 object_id 매핑한 리스트
        """
        results: List[Dict[str, Any]] = []
        if not events:
            return results
        if not lms:
            return [{**ev, "object_id": None} for ev in events]

        lm_count = len(lms)

        for ev in events:
            sensor_idx = ev.get("sensor_idx")
            obj_id: Optional[int] = None

            # 센서 인덱스가 유효하고 랜드마크가 있을 때만 매핑 시도
            if isinstance(sensor_idx, int) and 0 <= sensor_idx < lm_count:
                try:
                    px, py = lms[sensor_idx][:2]
                    obj_id = self.pick_best_object(px, py, obj_map)
                except Exception:
                    obj_id = None

            new_ev = dict(ev)
            new_ev["object_id"] = obj_id
            results.append(new_ev)

        return results