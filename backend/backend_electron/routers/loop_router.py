# routers/loop_router.py
# -------------------------------------------------------------
# 전역 재생(transport) + 루프(뮤트/선택/초기화) + 이벤트 입력 라우터
#  - set_pattern 엔드포인트 제거
# -------------------------------------------------------------
import os
from typing import Dict, Any
from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse
from managers.loop_manager import loop_manager

router = APIRouter()

# ====================== Transport (전역 타임라인) ======================

@router.get("/transport")
def get_transport():
    """전역 재생(transport) 상태 조회."""
    return loop_manager.transport_state()

@router.post("/transport/start")
async def transport_start(payload: Dict[str, Any] = Body(...)):
    """
    전역 타임라인 시작/재설정.
    Body 예: { "bars": 4, "bpm": 120, "beats_per_bar": 4, "t0_ms": 1733900000000 }
    - beats_per_bar, t0_ms 생략 가능
    """
    try:
        bars = int(payload.get("bars"))
        bpm  = int(payload.get("bpm"))
    except Exception:
        raise HTTPException(400, "bars and bpm must be int")
    beats_per_bar = int(payload.get("beats_per_bar", 4))
    try:
        return loop_manager.transport_start(
            bars=bars, bpm=bpm, beats_per_bar=beats_per_bar
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/transport/toggle")
async def transport_toggle(payload: Dict[str, Any] = Body(...)):
    if not isinstance(payload, dict) or "playing" not in payload:
        raise HTTPException(400, "playing is required")
    try:
        return loop_manager.transport_toggle(bool(payload["playing"]))
    except ValueError as e:
        raise HTTPException(400, str(e))

# ======================= 메트로놈 =====================

@router.get("/metronome")
def get_metronome_state():
    """메트로놈 상태 조회."""
    return loop_manager.get_metronome_state()

@router.post("/metronome/toggle")
def toggle_metronome(payload: Dict[str, Any] = Body(...)):
    # data 래핑 대응
    if "enabled" not in payload and isinstance(payload.get("data"), dict):
        payload = payload["data"]
    if "enabled" not in payload:
        raise HTTPException(400, "enabled is required")
    return loop_manager.toggle_metronome(bool(payload["enabled"]))

# ======================= 테스트용 키보드 이벤트 =====================

@router.post("/test/add-event")
def add_test_event(payload: Dict[str, Any] = Body(...)):
    """
    테스트용 이벤트 추가 (키보드 입력 시뮬레이션)
    Body: { 
        "objectId": "test_object_1", 
        "hand": "right", 
        "finger": "index", 
        "velocity": 1.0,
        "label": "테스트 이벤트"
    }
    """
    try:
        objectId = payload.get("objectId", "test_object_1")
        hand = payload.get("hand", "right")
        finger = payload.get("finger", "index")
        velocity = float(payload.get("velocity", 1.0))
        label = payload.get("label", "테스트 이벤트")
        
        result = loop_manager.add_test_event(
            objectId=objectId,
            hand=hand,
            finger=finger,
            velocity=velocity,
            label=label
        )
        
        # JSON 직렬화를 위해 Sound 객체 제거
        loop_info = {
            "id": result.get("id"),
            "name": result.get("name"),
            "active": result.get("active"),
            "events": []
        }
        
        # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
        for event in result.get("events", []):
            event_info = {
                "id": event.get("id"),
                "offset_ms": event.get("offset_ms"),
                "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
                "label": event.get("label")
            }
            loop_info["events"].append(event_info)
        
        return {
            "success": True,
            "message": f"테스트 이벤트 추가됨: {label}",
            "event": {
                "objectId": objectId,
                "hand": hand,
                "finger": finger,
                "velocity": velocity,
                "label": label
            },
            "loop": loop_info
        }
        
    except Exception as e:
        print(f"❌ 테스트 이벤트 추가 오류: {e}")
        import traceback
        print(f"🔍 상세 오류 정보:")
        traceback.print_exc()
        raise HTTPException(400, f"테스트 이벤트 추가 실패: {str(e)}")

@router.post("/test/clear-events")
def clear_test_events():
    """현재 선택된 루프의 모든 이벤트 삭제"""
    try:
        result = loop_manager.clear_test_events()
        
        # JSON 직렬화를 위해 Sound 객체 제거
        loop_info = {
            "id": result.get("id"),
            "name": result.get("name"),
            "active": result.get("active"),
            "events": []
        }
        
        # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
        for event in result.get("events", []):
            event_info = {
                "id": event.get("id"),
                "offset_ms": event.get("offset_ms"),
                "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
                "label": event.get("label")
            }
            loop_info["events"].append(event_info)
        
        return {
            "success": True,
            "message": "테스트 이벤트가 모두 삭제되었습니다",
            "loop": loop_info
        }
    except Exception as e:
        print(f"❌ 이벤트 삭제 오류: {e}")
        import traceback
        print(f"🔍 상세 오류 정보:")
        traceback.print_exc()
        raise HTTPException(400, f"이벤트 삭제 실패: {str(e)}")

# ============================ Loops ===================================

@router.post("")
def create_loop(payload: Dict[str, Any] = Body(default={})):
    """
    루프 생성.
    Body 예: { "name": "Loop 1" }  # 생략하면 "Untitled Loop"
    """
    try:
        name = (payload or {}).get("name")
        return JSONResponse(content=loop_manager.create_loop(name))
    except Exception as e:
        raise HTTPException(400, str(e))

@router.get("")
def list_loops():
    """모든 루프 + transport 상태 + 현재 선택 루프 ID 조회."""
    loops = loop_manager.list_loops()
    
    # JSON 직렬화를 위해 Sound 객체 제거
    serialized_loops = []
    for loop in loops:
        loop_info = {
            "id": loop.get("id"),
            "name": loop.get("name"),
            "active": loop.get("active"),
            "events": []
        }
        
        # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
        for event in loop.get("events", []):
            event_info = {
                "id": event.get("id"),
                "offset_ms": event.get("offset_ms"),
                "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
                "label": event.get("label")
            }
            loop_info["events"].append(event_info)
        
        serialized_loops.append(loop_info)
    
    return {
        "transport": loop_manager.transport_state(),
        "current_loop_id": loop_manager.current_loop_id,
        "loops": serialized_loops,
    }

@router.get("/{loop_id}")
def get_loop(loop_id: str):
    lp = loop_manager.get_loop(loop_id)
    if not lp:
        raise HTTPException(404, "Loop not found")
    
    # JSON 직렬화를 위해 Sound 객체 제거
    loop_info = {
        "id": lp.get("id"),
        "name": lp.get("name"),
        "active": lp.get("active"),
        "events": []
    }
    
    # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
    for event in lp.get("events", []):
        event_info = {
            "id": event.get("id"),
            "offset_ms": event.get("offset_ms"),
            "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
            "label": event.get("label")
        }
        loop_info["events"].append(event_info)
    
    return loop_info

@router.delete("/{loop_id}")
def delete_loop(loop_id: str):
    ok = loop_manager.delete_loop(loop_id)
    if not ok:
        raise HTTPException(404, "Loop not found")
    return {"ok": True, "current_loop_id": loop_manager.current_loop_id}

@router.post("/{loop_id}/clear")
def clear_loop(loop_id: str):
    try:
        result = loop_manager.clear_loop(loop_id)
        
        # JSON 직렬화를 위해 Sound 객체 제거
        loop_info = {
            "id": result.get("id"),
            "name": result.get("name"),
            "active": result.get("active"),
            "events": []
        }
        
        # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
        for event in result.get("events", []):
            event_info = {
                "id": event.get("id"),
                "offset_ms": event.get("offset_ms"),
                "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
                "label": event.get("label")
            }
            loop_info["events"].append(event_info)
        
        return loop_info
    except KeyError:
        raise HTTPException(404, "Loop not found")

@router.post("/{loop_id}/toggle")
def toggle_loop(loop_id: str, payload: Dict[str, Any] = Body(...)):
    """
    루프 소리 on/off.
    Body: { "active": true }
    """
    if not isinstance(payload, dict) or "active" not in payload:
        raise HTTPException(400, "active is required")
    try:
        result = loop_manager.toggle_loop(loop_id, bool(payload["active"]))
        
        # JSON 직렬화를 위해 Sound 객체 제거
        loop_info = {
            "id": result.get("id"),
            "name": result.get("name"),
            "active": result.get("active"),
            "events": []
        }
        
        # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
        for event in result.get("events", []):
            event_info = {
                "id": event.get("id"),
                "offset_ms": event.get("offset_ms"),
                "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
                "label": event.get("label")
            }
            loop_info["events"].append(event_info)
        
        return loop_info
    except KeyError:
        raise HTTPException(404, "Loop not found")

# ======================= Selection(이벤트 입력 대상) =====================

@router.post("/select")
def select_loop(payload: Dict[str, Any] = Body(...)):
    """
    현재 터치 입력을 받을 루프 선택.
    Body: { "id": "<loop_id>" }
    """
    if not isinstance(payload, dict) or "id" not in payload:
        raise HTTPException(400, "id is required")
    try:
        lp = loop_manager.select_loop(payload["id"])
        
        # JSON 직렬화를 위해 Sound 객체 제거
        loop_info = {
            "id": lp.get("id"),
            "name": lp.get("name"),
            "active": lp.get("active"),
            "events": []
        }
        
        # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
        for event in lp.get("events", []):
            event_info = {
                "id": event.get("id"),
                "offset_ms": event.get("offset_ms"),
                "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
                "label": event.get("label")
            }
            loop_info["events"].append(event_info)
        
        return {"current_loop_id": loop_manager.current_loop_id, "loop": loop_info}
    except KeyError:
        raise HTTPException(404, "Loop not found")

@router.post("/deselect")
def deselect_loop():
    """현재 선택된 루프를 해제합니다."""
    return loop_manager.deselect_loop()

@router.get("/current")
def get_current_loop():
    """선택된 루프 조회(없으면 loop=None)."""
    current_loop = loop_manager.get_current_loop()
    
    if current_loop is None:
        return {
            "current_loop_id": loop_manager.current_loop_id,
            "loop": None,
        }
    
    # JSON 직렬화를 위해 Sound 객체 제거
    loop_info = {
        "id": current_loop.get("id"),
        "name": current_loop.get("name"),
        "active": current_loop.get("active"),
        "events": []
    }
    
    # 이벤트에서 Sound 객체 제거하고 직렬화 가능한 정보만 포함
    for event in current_loop.get("events", []):
        event_info = {
            "id": event.get("id"),
            "offset_ms": event.get("offset_ms"),
            "velocity": float(event.get("velocity", 1.0)),  # numpy.float32를 float로 변환
            "label": event.get("label")
        }
        loop_info["events"].append(event_info)
    
    return {
        "current_loop_id": loop_manager.current_loop_id,
        "loop": loop_info,
    }
