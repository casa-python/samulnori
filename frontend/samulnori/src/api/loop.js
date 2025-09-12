import axios from 'axios';

// 별도 인스턴스: 로컬 루프 API는 쿠키 불필요 → withCredentials 비활성화
const loopApi = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' }
});

export const startTransport = ({ bpm, beatPerBar = 4, bars = 1 }) => {
  return loopApi.post('/loop/transport/start', { bpm, beatPerBar, bars });
};

export const toggleTransport = ({ playing }) => {
  return loopApi.post('/loop/transport/toggle', { playing });
};

export const createLoop = ({ name }) => {
  return loopApi.post('/loop', { name });
};

export const selectLoop = ({ id }) => {
  return loopApi.post('/loop/select', { id });
};

export const deselectLoop = () => {
  return loopApi.post('/loop/deselect');
};

export const deleteLoop = ({ id }) => {
  return loopApi.delete(`/loop/${id}`);
};

export const clearLoop = ({ id }) => {
  return loopApi.post(`/loop/${id}/clear`);
};

export const toggleLoopActive = ({ id, active }) => {
  return loopApi.post(`/loop/${id}/toggle`, { active });
};

export const getMetronomeState = () => {
  return loopApi.get('/loop/metronome');
};

export const toggleMetronome = ({ enabled }) => {
  return loopApi.post('/loop/metronome/toggle', { enabled });
};

export const addTestEvent = ({ objectId, hand, finger, velocity, label }) => {
  return loopApi.post('/loop/test/add-event', { objectId, hand, finger, velocity, label });
};

export const clearTestEvents = () => {
  return loopApi.post('/loop/test/clear-events');
};

export default {
  startTransport,
  toggleTransport,
  createLoop,
  selectLoop,
  deselectLoop,
  deleteLoop,
  clearLoop,
  toggleLoopActive,
  getMetronomeState,
  toggleMetronome,
  addTestEvent,
  clearTestEvents,
};


