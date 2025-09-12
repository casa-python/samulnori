import { create } from 'zustand';

function computeLoopDurationMs(bpm, beatPerBar, bars) {
  const beats = beatPerBar * Math.max(1, bars);
  const secondsPerBeat = 60 / Math.max(1, bpm || 120);
  return beats * secondsPerBeat * 1000;
}

const useLoopStore = create((set, get) => ({
  loops: [], // { id, name, events: [{ objectId, hand, finger, timing }], active }
  selectedLoopId: null,
  transport: { bpm: 120, beatPerBar: 4, bars: 1, playing: false, phase: 0 },
  metronome: { enabled: true },
  recording: { isRecording: false, startTimestampMs: 0, pendingEvents: [] },
  pendingSelectLoopId: null,

  setTransport: (partial) => set((state) => ({ transport: { ...state.transport, ...partial } })),
  setMetronome: (partial) => set((state) => ({ metronome: { ...state.metronome, ...partial } })),

  addLoop: ({ id, name }) => set((state) => ({
    loops: [...state.loops, { id, name, events: [], active: true }]
  })),

  removeLoop: (id) => set((state) => ({
    loops: state.loops.filter(l => l.id !== id),
    selectedLoopId: state.selectedLoopId === id ? null : state.selectedLoopId,
  })),

  clearLoop: (id) => set((state) => ({
    loops: state.loops.map(l => l.id === id ? { ...l, events: [] } : l)
  })),

  toggleLoopActiveLocal: (id, active) => set((state) => ({
    loops: state.loops.map(l => l.id === id ? { ...l, active } : l)
  })),

  selectLoopLocal: (id) => set(() => ({
    selectedLoopId: id,
    recording: { isRecording: true, startTimestampMs: performance.now(), pendingEvents: [] },
  })),

  deselectLoopLocal: () => set(() => ({
    recording: { isRecording: false, startTimestampMs: 0, pendingEvents: [] },
    selectedLoopId: null,
  })),

  handleIncomingEvent: (evt) => {
    // evt: { objectId, hand, finger, on: boolean, tsMs?: number }
    const { recording } = get();
    if (!recording.isRecording) return;
    if (!evt?.on) return; // on=true일 때만 기록
    const ts = typeof evt.tsMs === 'number' ? evt.tsMs : performance.now();
    set((state) => ({
      recording: {
        ...state.recording,
        pendingEvents: [
          ...state.recording.pendingEvents,
          { objectId: evt.objectId, hand: evt.hand, finger: evt.finger, tsMs: ts },
        ],
      }
    }));
  },

  finalizeRecording: () => {
    const { recording, selectedLoopId, transport } = get();
    if (!selectedLoopId) return;
    const durationMs = computeLoopDurationMs(transport.bpm, transport.beatPerBar, transport.bars);
    const startTs = recording.startTimestampMs || performance.now();
    const events = (recording.pendingEvents || []).map(pe => {
      const delta = (pe.tsMs - startTs) % durationMs;
      const timing = Math.max(0, Math.min(1, delta / durationMs));
      return { objectId: pe.objectId, hand: pe.hand, finger: pe.finger, timing };
    });
    set((state) => ({
      loops: state.loops.map(l => l.id === selectedLoopId ? { ...l, events: [...l.events, ...events] } : l),
      recording: { isRecording: false, startTimestampMs: 0, pendingEvents: [] },
    }));
  },

  setPendingSelectLoop: (loopId) => set(() => ({ pendingSelectLoopId: loopId || null })),
  clearPendingSelect: () => set(() => ({ pendingSelectLoopId: null })),
}));

export default useLoopStore;


