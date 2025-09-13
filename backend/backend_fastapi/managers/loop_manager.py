from __future__ import annotations
import uuid
import asyncio
import time
import os
from typing import Dict, List, Optional, Any, Set

from utils.sound_engine import sound_engine as engine, Sound  # Engine unchanged

# ========= Time helpers =========

def now_s() -> float:
    """Monotonic, absolute seconds (float)."""
    return time.perf_counter()

# ========= Tuning =========
BOUNDARY_PREFETCH_S = 0.05   # pre-schedule next cycle a bit earlier
COALESCE_BIN_S     = 0.001  # group events within ±1ms into one callback
MICROSPIN_S        = 0.001  # final busy-wait window to hit target more tightly


class LoopManager:
    """
    Loop-station manager with boundary scheduling.

    IMPORTANT: The audio engine is unchanged. We do *not* rely on engine clocks or engine scheduling.
    We minimize jitter by:
      - scheduling with asyncio timer handles (no per-event tasks),
      - coalescing same-time events into a single callback,
      - micro-spinning for ≤1ms to fire right at the target.

    Transport fields (seconds):
      playing, bars, bpm, beats_per_bar, length_s, t0_s

    Loop:
      { id, name, active, events: [{ id, sound, offset_s, label }] }
    """

    def __init__(self) -> None:
        # --- transport ---
        self.transport: Dict[str, Any] = {
            "playing": False,
            "bars": None,
            "bpm": None,
            "beats_per_bar": None,
            "length_s": None,
            "t0_s": None,
        }

        # --- loops / selection ---
        self.loops: Dict[str, dict] = {}
        self.current_loop_id: Optional[str] = None

        # --- metronome (single sound; strong/weak via volume only) ---
        self.metronome_enabled: bool = True
        metronome_path = os.path.join(os.path.dirname(__file__), "..", "assets", "metronome.mp3")
        self.metronome_sound: Optional[Sound] = engine.load_sound(metronome_path)

        # --- asyncio ---
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._scheduler_task: Optional[asyncio.Task] = None

        # ---- timer handles & bundles ----
        # time-bin key -> {"when": float, "payloads": list[dict], "handle": TimerHandle}
        self._time_bundles: Dict[int, Dict[str, Any]] = {}
        # per-loop tracking uses bin-keys for cancellation
        self._scheduled_by_loop: Dict[str, Set[int]] = {}
        self._scheduled_metro: Set[int] = set()

        self._scheduled_cycles: Set[int] = set()

    # ==================== metronome ====================
    def toggle_metronome(self, enabled: bool) -> dict:
        self.metronome_enabled = bool(enabled)
        return {"metronome_enabled": self.metronome_enabled}

    def get_metronome_state(self) -> dict:
        return {
            "enabled": self.metronome_enabled,
            "sound_loaded": self.metronome_sound is not None,
        }

    # ==================== transport ====================
    def transport_state(self) -> dict:
        return dict(self.transport)

    def transport_start(self, *, bars: int, bpm: int, beats_per_bar: int = 4) -> dict:
        if not isinstance(bars, int) or bars < 1:
            raise ValueError("bars must be int >= 1")
        if not isinstance(bpm, int) or not (30 <= bpm <= 300):
            raise ValueError("bpm must be 30..300")
        if not isinstance(beats_per_bar, int) or not (1 <= beats_per_bar <= 16):
            raise ValueError("beats_per_bar must be 1..16")

        length_s = bars * beats_per_bar * (60.0 / float(bpm))
        self.transport.update({
            "bars": bars,
            "bpm": bpm,
            "beats_per_bar": beats_per_bar,
            "length_s": float(length_s),
            "t0_s": now_s(),
            "playing": True,
        })

        self._scheduled_cycles.clear()
        self._cancel_all_scheduled()
        self._ensure_scheduler_running()
        return self.transport_state()

    def transport_toggle(self, playing: bool) -> dict:
        if not isinstance(playing, bool):
            raise ValueError("playing must be boolean")
        if playing:
            if self.transport.get("length_s") is None:
                raise ValueError("Transport not configured. Call /transport/start first.")
            self.transport["t0_s"] = now_s()
            self.transport["playing"] = True
            self._scheduled_cycles.clear()
            self._cancel_all_scheduled()
            self._ensure_scheduler_running()
        else:
            self.transport["playing"] = False
            self._cancel_all_scheduled()
            self._cancel_scheduler()
        return self.transport_state()

    # ==================== loops ====================
    def create_loop(self, name: Optional[str] = None) -> dict:
        nm = (name or "").strip() or "Untitled Loop"
        lp = {"id": str(uuid.uuid4()), "name": nm, "active": True, "events": []}
        self.loops[lp["id"]] = lp
        return lp

    def list_loops(self) -> List[dict]:
        return list(self.loops.values())

    def get_loop(self, loop_id: str) -> Optional[dict]:
        return self.loops.get(loop_id)

    def delete_loop(self, loop_id: str) -> bool:
        removed = self.loops.pop(loop_id, None)
        if removed and self.current_loop_id == loop_id:
            self.current_loop_id = None
        if removed:
            self._cancel_scheduled_for_loop(loop_id)
        return removed is not None

    def clear_loop(self, loop_id: str) -> dict:
        lp = self._must(loop_id)
        lp["events"].clear()
        self._cancel_scheduled_for_loop(loop_id)
        return lp

    def toggle_loop(self, loop_id: str, active: bool) -> dict:
        lp = self._must(loop_id)
        lp["active"] = bool(active)
        if not active:
            self._cancel_scheduled_for_loop(loop_id)
        return lp

    # ==================== selection ====================
    def select_loop(self, loop_id: str) -> dict:
        lp = self._must(loop_id)
        self.current_loop_id = loop_id
        return lp

    def deselect_loop(self) -> dict:
        self.current_loop_id = None
        return {"current_loop_id": None, "message": "Loop deselected"}

    def get_current_loop(self) -> Optional[dict]:
        if not self.current_loop_id:
            return None
        return self.loops.get(self.current_loop_id)

    # ==================== events ====================
    def add_sound_event_to_current(self, *, sound: Sound, ts_s: Optional[float] = None, velocity: Optional[float] = 1.0, label: Optional[str] = None) -> dict:
        if not self.current_loop_id:
            raise ValueError("No loop selected")
        if sound is None or not hasattr(sound, "play"):
            raise ValueError("sound must be a Sound-like object with .play()")
        if ts_s is None or not isinstance(ts_s, float):
            ts_s = now_s()

        L = self.transport.get("length_s")
        t0 = self.transport.get("t0_s")
        if L is None or t0 is None:
            raise ValueError("Transport not started (length_s/t0_s is None)")

        offset = float((ts_s - float(t0)) % float(L))
        lp = self.loops[self.current_loop_id]
        lp["events"].append({
            "id": str(uuid.uuid4()),
            "sound": sound,
            "offset_s": offset,
            "label": label or None,
        })
        print(f"add completed: {time.perf_counter()}s")
        return lp

    # ==================== scheduler (boundary-based) ====================
    def _ensure_scheduler_running(self):
        if self._scheduler_task and not self._scheduler_task.done():
            return
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            raise RuntimeError("LoopManager must be used from within an asyncio event loop (e.g., FastAPI/uvicorn).")
        self._scheduler_task = self._loop.create_task(self._scheduler_main())

    def _cancel_scheduler(self):
        if self._scheduler_task and not self._scheduler_task.done():
            self._scheduler_task.cancel()
        self._scheduler_task = None

    async def _scheduler_main(self):
        while True:
            if not self.transport.get("playing"):
                await asyncio.sleep(0.05)
                continue

            L = self.transport.get("length_s")
            t0 = self.transport.get("t0_s")
            bpm = self.transport.get("bpm")
            bpb = self.transport.get("beats_per_bar")
            if L is None or t0 is None or bpm is None or bpb is None:
                await asyncio.sleep(0.05)
                continue

            now = now_s()
            cycle_idx = int((now - t0) // L)

            if cycle_idx not in self._scheduled_cycles:
                self._schedule_cycle(cycle_idx)
                self._scheduled_cycles.add(cycle_idx)

            next_boundary = t0 + (cycle_idx + 1) * L
            prefetch = float(BOUNDARY_PREFETCH_S)
            time_to_boundary = max(0.0, next_boundary - now_s())
            if time_to_boundary > prefetch:
                try:
                    await asyncio.sleep(time_to_boundary - prefetch)
                except asyncio.CancelledError:
                    break

            if self.transport.get("playing"):
                upcoming = cycle_idx + 1
                if upcoming not in self._scheduled_cycles:
                    self._schedule_cycle(upcoming)
                    self._scheduled_cycles.add(upcoming)

            remain = max(0.0, next_boundary - now_s())
            try:
                await asyncio.sleep(remain)
            except asyncio.CancelledError:
                break

    # ---- per-cycle scheduling ----
    def _schedule_cycle(self, cycle_idx: int) -> None:
        L = float(self.transport.get("length_s"))
        t0 = float(self.transport.get("t0_s"))
        bpm = int(self.transport.get("bpm"))
        bpb = int(self.transport.get("beats_per_bar"))
        cycle_start = t0 + cycle_idx * L

        self._schedule_metronome_for_cycle(cycle_start, L, bpm, bpb)

        for lp in self.loops.values():
            if not lp.get("active", True):
                continue
            for ev in lp.get("events", []):
                snd: Sound = ev.get("sound")
                if snd is None:
                    continue
                offset = float(ev.get("offset_s", 0.0))
                when_s = cycle_start + offset
                payload = {
                    "type": "loop_event",
                    "loop_id": lp["id"],
                    "label": ev.get("label"),
                    "sound": snd,
                }
                self._launch_at(when_s, payload)

    def _schedule_metronome_for_cycle(self, cycle_start: float, L: float, bpm: int, bpb: int) -> None:
        if self.metronome_sound is None:
            return
        beat_s = 60.0 / float(bpm)
        
        # 전체 루프의 모든 비트에 대해 메트로놈 스케줄링
        # bars * beats_per_bar만큼 반복해야 함
        bars = int(self.transport.get("bars", 1))
        total_beats = bars * bpb
        
        for i in range(total_beats):
            # 사이클 시작점부터 각 비트의 시간 계산
            beat_offset = i * beat_s
            when_s = cycle_start + beat_offset
            
            # 강한 비트인지 판단 (각 바의 첫 번째 비트가 강한 비트)
            is_strong = (i % bpb) == 0
            vol = (0.7 if is_strong else 0.5) if self.metronome_enabled else 0.0
            
            payload = {
                "type": "metronome",
                "beat_num": i,  # 전체 루프 내 비트 번호
                "beat_in_bar": i % bpb,  # 현재 바 내에서의 비트 번호
                "bar_num": i // bpb,  # 현재 바 번호
                "is_strong": is_strong,
                "sound": self.metronome_sound,
                "volume": vol,
            }
            self._launch_at(when_s, payload)

    # ---- timer-based launcher with binning & microspin ----
    def _bin_key(self, when_s: float) -> int:
        return int(round(when_s / COALESCE_BIN_S))

    def _launch_at(self, when_s: float, payload: dict) -> Any:
        if self._loop is None:
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                raise RuntimeError("LoopManager must be used within an asyncio event loop.")

        key = self._bin_key(when_s)
        bundle = self._time_bundles.get(key)
        if bundle is not None:
            bundle["payloads"].append(payload)
        else:
            delay = max(0.0, when_s - now_s() - MICROSPIN_S)
            handle = self._loop.call_later(delay, self._fire_bundle, when_s, key)
            self._time_bundles[key] = {"when": when_s, "payloads": [payload], "handle": handle}

        # track for cancellation
        if payload.get("type") == "loop_event":
            loop_id = payload.get("loop_id")
            if loop_id:
                self._scheduled_by_loop.setdefault(loop_id, set()).add(key)
        else:
            self._scheduled_metro.add(key)

    def _fire_bundle(self, target_s: float, key: int) -> None:
        # final micro-wait to tighten to target_s (blocks event loop ≤ MICROSPIN_S)
        while True:
            rem = target_s - now_s()
            if rem <= 0:
                break
            if rem > MICROSPIN_S:
                # should be rare; sleep coarsely then loop
                time.sleep(rem - MICROSPIN_S)
            else:
                # last 1ms: spin lightly
                if rem > 0.0002:
                    time.sleep(rem * 0.5)
                else:
                    # sub-200µs: just spin
                    pass
        bundle = self._time_bundles.pop(key, None)
        if not bundle:
            return
        payloads = bundle.get("payloads", [])
        # cleanup tracking sets (keys may be present in both)
        self._scheduled_metro.discard(key)
        for s in self._scheduled_by_loop.values():
            s.discard(key)
        for p in payloads:
            self._play_payload(p)

    def _play_payload(self, payload: dict):
        snd: Sound = payload.get("sound")
        if snd is None:
            return
        try:
            if payload.get("type") == "metronome":
                # accept either 'volume' or legacy 'velocity'
                vol = payload.get("volume", payload.get("velocity"))
                snd.play(volume=vol)
            else:
                snd.play()
        except Exception:
            pass

    # ==================== cancellation helpers ====================
    def _cancel_all_scheduled(self):
        # cancel all timer handles
        for key, b in list(self._time_bundles.items()):
            h = b.get("handle")
            try:
                if h is not None:
                    h.cancel()
            except Exception:
                pass
        self._time_bundles.clear()
        self._scheduled_metro.clear()
        self._scheduled_by_loop.clear()

    def _cancel_scheduled_for_loop(self, loop_id: str):
        keys = self._scheduled_by_loop.get(loop_id)
        if not keys:
            return
        for key in list(keys):
            b = self._time_bundles.pop(key, None)
            if b is None:
                continue
            h = b.get("handle")
            try:
                if h is not None:
                    h.cancel()
            except Exception:
                pass
        keys.clear()

    # ==================== utilities ====================
    def _must(self, loop_id: str) -> dict:
        lp = self.get_loop(loop_id)
        if not lp:
            raise KeyError("Loop not found")
        return lp

    # ==================== test helpers (engine unchanged) ====================
    def add_test_event(self, *, objectId: str, hand: str = "right", finger: str = "index", velocity: float = 1.0, label: str = "테스트 이벤트") -> dict:
        """현재 선택된 루프에 테스트 이벤트를 추가.
        - objectId에 'kick' / 'piano'가 들어가면 샘플 선택
        - 샘플 로드 실패 시 짧은 사인파로 대체
        - 이벤트는 루프에만 추가되고, 볼륨은 즉시 청취용으로만 사용(메트로놈 외엔 저장 안 함)
        """
        if not self.current_loop_id:
            raise ValueError("이벤트를 추가할 루프가 선택되지 않았습니다. 먼저 루프를 생성하고 선택해주세요.")

        ts_s = now_s()

        import os
        sound = None
        # 1) 샘플 시도
        try:
            base = os.path.dirname(os.path.dirname(__file__))
            if "kick" in objectId.lower():
                sound_path = os.path.join(base, "samples", "kick.wav")
            elif "piano" in objectId.lower():
                sound_path = os.path.join(base, "samples", "piano.wav")
            else:
                sound_path = os.path.join(base, "samples", "kick.wav")
            sound = engine.load_sound(sound_path, volume=velocity)
        except Exception:
            # 2) 실패 시 사인파 대체
            try:
                import numpy as np
                freq = 440.0 if "piano" in objectId.lower() else 220.0
                dur = 0.1
                t = np.linspace(0, dur, int(44100 * dur), False)
                wave = np.sin(2 * np.pi * freq * t).astype(np.float32)
                data = np.column_stack([wave, wave])
                sound = Sound(f"test_sound_{objectId}", data, engine, velocity)
            except Exception as e:
                raise RuntimeError(f"테스트 사운드 생성 실패: {e}")

        # 즉시 한 번 재생(피드백용)
        try:
            sound.play(volume=velocity)
        except Exception:
            pass

        return self.add_sound_event_to_current(sound=sound, ts_s=ts_s, velocity=velocity, label=label)

    def clear_test_events(self) -> dict:
        if not self.current_loop_id:
            raise ValueError("선택된 루프가 없습니다")
        return self.clear_loop(self.current_loop_id)


# Singleton
loop_manager = LoopManager()
