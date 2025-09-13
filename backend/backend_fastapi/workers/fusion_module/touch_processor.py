from dataclasses import dataclass
from typing import Optional, Dict, List, Any, Tuple

@dataclass
class SensorPolicy:
    # 정책은 0~1 정규화 기준으로 유지
    th_on: float = 0.08
    th_off: float = 0.06
    debounce_ms: int = 10
    retrigger_ms: int = 20
    ema_alpha: float = 0.9
    vel_curve: float = 1.0
    aftertouch_eps: float = 0.04  # 0~1 정규화 기준 (0이면 AT 끔)

@dataclass
class SensorState:
    ema: float = 0.0                 # raw 단위(0~SENSOR_MAX)
    pressed: bool = False
    last_change_ts: Optional[float] = None
    last_on_ts: Optional[float] = None
    last_aftertouch: float = 0.0     # raw 단위(0~SENSOR_MAX)

class TouchProcessor:
    """FSR -> on/off/aftertouch 이벤트 (object 정보 없음, 고정 정책 사용)"""
    def __init__(
        self,
        policy: Optional[SensorPolicy] = None,
        sensor_max: float = 4095.0,
        policy_normalized: bool = True,  # True면 정책을 0~1로 보고 sensor_max로 스케일
    ):
        self._policy = policy or SensorPolicy()
        self._states: Dict[Tuple[str, int], SensorState] = {}
        self._sensor_max = float(sensor_max)
        self._policy_normalized = bool(policy_normalized)

    def _eff(self, v: float) -> float:
        """정책 값 -> raw 단위로 환산"""
        return v * self._sensor_max if self._policy_normalized else v

    def update(self, hand: str, fsr: List[float], ts: float) -> List[Dict[str, Any]]:
        events: List[Dict[str, Any]] = []
        if len(fsr) < 7:
            fsr = fsr + [0.0] * (7 - len(fsr))

        pol = self._policy
        th_on_eff = self._eff(pol.th_on)
        th_off_eff = self._eff(pol.th_off)
        at_eps_eff = self._eff(pol.aftertouch_eps)

        # 안전장치
        span = max(1.0, th_on_eff - th_off_eff)  # 0 방지

        for i in range(7):
            key = (hand, i)
            st = self._states.setdefault(key, SensorState())

            # 1) EMA (raw 단위 유지)
            raw = float(fsr[i] or 0.0)
            st.ema = pol.ema_alpha * raw + (1.0 - pol.ema_alpha) * st.ema
            # clamp
            if st.ema < 0.0:
                st.ema = 0.0
            elif st.ema > self._sensor_max:
                st.ema = self._sensor_max

            # 2) 히스테리시스 on/off + 디바운스/재트리거 (raw 임계 비교)
            want_pressed = (st.ema >= th_on_eff) if not st.pressed else (st.ema > th_off_eff)
            if want_pressed != st.pressed:
                if st.last_change_ts and (ts - st.last_change_ts) < (pol.debounce_ms / 1000.0):
                    pass  # 디바운스: 무시
                else:
                    st.pressed = want_pressed
                    st.last_change_ts = ts
                    if st.pressed:
                        # velocity: 히스테리시스 구간을 0~1로 매핑 후 곡선 적용
                        norm_span = (st.ema - th_off_eff) / span
                        if norm_span < 0.0: norm_span = 0.0
                        elif norm_span > 1.0: norm_span = 1.0
                        vel = (norm_span ** pol.vel_curve)

                        if (not st.last_on_ts) or (ts - st.last_on_ts) >= (pol.retrigger_ms / 1000.0):
                            events.append({
                                "type": "on",
                                "hand": hand,
                                "sensor_idx": i,
                                "velocity": vel,
                                "timestamp": ts,
                            })
                            st.last_on_ts = ts
                            st.last_aftertouch = st.ema
                    else:
                        events.append({
                            "type": "off",
                            "hand": hand,
                            "sensor_idx": i,
                            "timestamp": ts,
                        })

            # 3) aftertouch (raw 비교, 필요 시 활성화)
            if st.pressed and at_eps_eff > 0.0:
                if abs(st.ema - st.last_aftertouch) >= at_eps_eff:
                    # 필요 시 사용
                    # events.append({
                    #     "type": "aftertouch",
                    #     "hand": hand,
                    #     "sensor_idx": i,
                    #     "pressure": min(1.0, max(0.0, st.ema / self._sensor_max)),
                    #     "timestamp": ts
                    # })
                    st.last_aftertouch = st.ema

        return events

    def update_always_on(self, hand: str, fsr: List[float], ts: float) -> List[Dict[str, Any]]:
        """테스트용: 0~6 모든 센서에서 무조건 'on' 이벤트 발생"""
        return [{
            "type": "on",
            "hand": hand,
            "sensor_idx": i,
            "velocity": 1.0,
            "timestamp": ts,
        } for i in range(7)]
