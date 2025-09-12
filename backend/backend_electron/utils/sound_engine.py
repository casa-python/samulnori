import sounddevice as sd
import soundfile as sf
import numpy as np
import resampy
import threading
import itertools
from typing import Optional, Any, Dict

SAMPLERATE = 48000
BLOCKSIZE = 256

def _ensure_stereo(data: np.ndarray) -> np.ndarray:
    """(frames, channels) float32 -> stereo float32"""
    if data.ndim != 2:
        raise ValueError("Audio data must be 2D (frames, channels)")
    if data.shape[1] == 1:
        return np.repeat(data, 2, axis=1)
    elif data.shape[1] == 2:
        return data
    else:
        # 다채널이면 간단히 전채널 평균 -> 스테레오 복제
        mono = np.mean(data, axis=1, keepdims=True).astype(np.float32)
        return np.repeat(mono, 2, axis=1)

class Sound:
    """외부에서 들고 다니는 '소리' 객체"""
    def __init__(self, path: str, data: np.ndarray, engine: "SoundEngine", volume: float = 1.0):
        # (frames, 1|2) float32, samplerate == SAMPLERATE 가정
        if data.dtype != np.float32:
            data = data.astype(np.float32)
        self.path = path
        self.data = _ensure_stereo(data)
        self.engine = engine
        self.volume = float(volume)

    def play(self, volume: Optional[float] = None) -> int:
        """소리를 재생하고 voice_id 반환(폴리포니)."""
        gain = self.volume if volume is None else float(volume)
        return self.engine._start_voice(self, gain)

    def stop(self, voice_id: int):
        """특정 재생 인스턴스(voice)만 정지."""
        self.engine._stop_voice(voice_id)

    def set_volume(self, volume: float):
        self.volume = float(volume)

class SoundEngine:
    def __init__(self, latency="low"):
        self.latency = latency
        self.stream: Optional[sd.OutputStream] = None

        # === 콜백 내 할당 제거용 사전 버퍼들 ===
        self._mix_buf = np.zeros((BLOCKSIZE, 2), dtype=np.float32)
        self._tmp_chunk = np.zeros((BLOCKSIZE, 2), dtype=np.float32)

        # active_voices: dict[voice_id] = {"sound": Sound, "pos": int, "gain": float}
        self._active_voices: Dict[int, Dict[str, Any]] = {}
        self._voice_id_gen = itertools.count(1)
        self._lock = threading.Lock()

    # -------- 로딩 유틸 --------
    def load_sound(self, path: str, volume: float = 1.0) -> Sound:
        """파일에서 Sound 생성 (샘플레이트 자동 리샘플링)"""
        data, sr = sf.read(path, dtype='float32', always_2d=True)
        if sr != SAMPLERATE:
            # resampy는 (ch, n) 포맷
            data = resampy.resample(data.T, sr, SAMPLERATE, filter='kaiser_best').T.astype(np.float32)
        data = _ensure_stereo(data).astype(np.float32, copy=False)
        return Sound(path, data, self, float(volume))
    # -------- 스트림 제어 --------
    def start(self):
        if self.stream is not None:
            return
        self.stream = sd.OutputStream(
            samplerate=SAMPLERATE,
            channels=2,
            blocksize=BLOCKSIZE,
            callback=self._audio_callback,
            dtype='float32',
            latency=self.latency
        )
        self.stream.start()

    def stop(self):
        if self.stream is None:
            return
        self.stream.stop()
        self.stream.close()
        self.stream = None
        with self._lock:
            self._active_voices.clear()

    # -------- 재생/정지 (Sound에서 호출) --------
    def _start_voice(self, sound: Sound, gain: float) -> int:
        voice_id = next(self._voice_id_gen)
        with self._lock:
            self._active_voices[voice_id] = {"sound": sound, "pos": 0, "gain": float(gain)}
        return voice_id

    def _stop_voice(self, voice_id: int):
        with self._lock:
            self._active_voices.pop(voice_id, None)

    # -------- 오디오 콜백 --------
    def _audio_callback(self, outdata, frames, time, status):
        if status:
            # 콜백에서 프린트 남발은 XRUN 유발하니 정말 필요할 때만
            # print(f"[SoundEngine] Audio callback status: {status}", flush=True)
            pass

        # 로컬 믹스 버퍼 확보/초기화
        mix = self._mix_buf
        mix[:frames].fill(0.0)

        with self._lock:
            if not self._active_voices:
                outdata.fill(0.0)
                return
            items = tuple(self._active_voices.items())

        voices_finished = []
        for vid, v in items:
            data = v["sound"].data
            pos = v["pos"]
            gain = v["gain"]

            remaining = data.shape[0] - pos
            if remaining <= 0:
                voices_finished.append(vid)
                continue

            n = remaining if remaining < frames else frames

            # per-voice 임시 버퍼 재사용 (할당 제거)
            src = data[pos:pos+n]          # (n, 2) view
            tmp = self._tmp_chunk[:n]      # (n, 2) 재사용 버퍼
            np.multiply(src, gain, out=tmp)
            mix[:n] += tmp

            # pos 업데이트는 나중에 일괄
            v["pos"] = pos + n
            if v["pos"] >= data.shape[0]:
                voices_finished.append(vid)

        # 바로 장치 버퍼(outdata)에 클립-쓰기 (불필요한 복사 제거)
        np.clip(mix[:frames], -1.0, 1.0, out=outdata[:frames, :])

        # pos 반영 및 finished 제거
        with self._lock:
            for vid, v in items:
                if vid in self._active_voices:
                    self._active_voices[vid]["pos"] = v["pos"]
            for vid in voices_finished:
                self._active_voices.pop(vid, None)

sound_engine = SoundEngine()
sound_engine.start()