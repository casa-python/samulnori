from typing import Dict, Optional, List, Any
from dataclasses import dataclass

@dataclass
class BindPolicy:
    switch_dwell_ms: int = 20  # 오브젝트 전환 지연(스틱키)

@dataclass
class BindState:
    bound_obj: Optional[int] = None
    until_ts: float = 0.0

class ObjectBinder:
    """스틱키 바인딩: 센서별 바운드 object_id를 유지하고 이벤트에 최종 object_id를 붙인다."""
    def __init__(self, policy: BindPolicy | None = None):
        self.policy = policy or BindPolicy()
        self._states: Dict[tuple[str,int], BindState] = {}

    # mapper의 결과(events에 object_id가 포함된 형태)를 그대로 받아서 처리
    def annotate_mapped_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        events: mapper.map_events_to_objects() 결과
                [{"type": "on"/"off", "hand": "left"/"right", "sensor": int,
                  "timestamp": float, "object_id": Optional[int], ...}, ...]
        반환: stickiness 적용 후 최종 object_id가 붙은 이벤트 리스트
        """
        out: List[Dict[str, Any]] = []
        dwell = self.policy.switch_dwell_ms / 1000.0

        for ev in events:
            # 필수 필드 체크
            side = ev.get("hand")
            sensor_idx = ev.get("sensor")
            ts = ev.get("timestamp", 0.0)

            if side is None or sensor_idx is None:
                # 손/센서 정보 없으면 그대로 통과
                out.append(ev)
                continue

            key = (str(side), int(sensor_idx))
            st = self._states.setdefault(key, BindState())

            # 이번 관측 후보(object_id) 가져오기
            cur_obj = ev.get("object_id", None)

            # 스틱키 갱신 로직
            if st.bound_obj != cur_obj:
                if ts >= st.until_ts:
                    st.bound_obj = cur_obj
                    st.until_ts = ts + dwell
                # else: 윈도 내에서는 이전 바인딩 유지

            # 최종 바운드 object_id를 이벤트에 부착(관측값 대신 바운드 값 사용)
            new_ev = dict(ev)
            new_ev["object_id"] = st.bound_obj
            out.append(new_ev)

        return out
