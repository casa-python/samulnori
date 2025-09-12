import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocketMessage } from '../contexts/WebSocketContext';

/**
 * WebSocket 'events' 메시지를 구독하여 최근 터치된 객체/손가락을 임시로 강조 표기하기 위한 훅
 * - 유지 시간: default 600ms (연속 on/aftertouch로 갱신)
 * - 백엔드에서 'event' 타입으로 보내지만 'events'로도 처리
 */
const useTouchEvents = (highlightMs = 600) => {
  const [activeObjectIds, setActiveObjectIds] = useState(() => new Set());
  const [activeFingers, setActiveFingers] = useState(() => new Set()); // key: `${hand}:${sensor}`

  // 타이머 레지스트리: 객체/손가락별 만료 예약
  const objectTimersRef = useRef(new Map());
  const fingerTimersRef = useRef(new Map());

  const scheduleExpiry = useCallback((registry, key, clearFn) => {
    const existing = registry.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      registry.delete(key);
      clearFn(key);
    }, highlightMs);
    registry.set(key, t);
  }, [highlightMs]);

  const addActiveObject = useCallback((objectId) => {
    if (typeof objectId !== 'number' || !Number.isFinite(objectId)) return;
    setActiveObjectIds((prev) => {
      if (prev.has(objectId)) return prev;
      const next = new Set(prev);
      next.add(objectId);
      return next;
    });
    scheduleExpiry(objectTimersRef.current, objectId, (id) => {
      setActiveObjectIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }, [scheduleExpiry]);

  const addActiveFinger = useCallback((hand, sensor) => {
    if (!hand || (sensor === null || sensor === undefined)) return;
    const key = `${hand}:${sensor}`;
    setActiveFingers((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    // 손가락은 'off' 이벤트가 올 때까지 유지
  }, []);

  // 메시지 처리기
  const handleEvents = useCallback((msg) => {
    const arr = Array.isArray(msg?.data) ? msg.data : [];
    for (const ev of arr) {
      const t = ev?.type;
      const hand = ev?.hand;
      const sensor = ev?.sensor_idx;
      const objectId = ev?.object_id;
      
      // on/aftertouch만 강조(press/모듈레이션). off은 즉시 제거가 필요할 수도 있으나, UX상 잔광 유지가 자연스러움
      if (t === 'on' || t === 'aftertouch') {
        if (objectId !== null && objectId !== undefined) {
          addActiveObject(Number(objectId));
        }
        if (hand && sensor !== null && sensor !== undefined) {
          addActiveFinger(String(hand), Number(sensor));
        }
      }
      if (t === 'off') {
        // off일 때는 손가락 잔광을 빠르게 줄임
        if (hand && sensor !== null && sensor !== undefined) {
          const key = `${String(hand)}:${Number(sensor)}`;
          const timer = fingerTimersRef.current.get(key);
          if (timer) clearTimeout(timer);
          fingerTimersRef.current.delete(key);
          setActiveFingers((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }
    }
  }, [addActiveObject, addActiveFinger]);

  // 백엔드에서 'event' 타입으로 보내지만 'events'로도 처리
  useWebSocketMessage('event', handleEvents, [handleEvents]);

  // 헬퍼
  const isObjectActive = useCallback((id) => activeObjectIds.has(id), [activeObjectIds]);
  const isFingerActive = useCallback((hand, sensor) => activeFingers.has(`${hand}:${sensor}`), [activeFingers]);

  // 정리
  useEffect(() => () => {
    objectTimersRef.current.forEach((t) => clearTimeout(t));
    fingerTimersRef.current.forEach((t) => clearTimeout(t));
    objectTimersRef.current.clear();
    fingerTimersRef.current.clear();
  }, []);

  return { activeObjectIds, activeFingers, isObjectActive, isFingerActive };
};

export default useTouchEvents;


