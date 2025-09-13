from fastapi import APIRouter
from managers.status_manager import status_manager
from managers.thread_manager import thread_manager

router = APIRouter()

@router.get("")
def get_status():
    with status_manager._lock:
        return {
            "running": status_manager.running,
            "webcam_on": status_manager.webcam_on,
            "yolo_on": status_manager.yolo_on,
            "mediapipe_on": status_manager.mediapipe_on,
            "streaming": status_manager.streaming,
            "glove_on": status_manager.glove_on
        }

@router.post("/{key}/{value}")
def set_status(key: str, value: str):
    valid_keys = {
        "running", "webcam_on", "glove_on", "yolo_on", "mediapipe_on", "streaming"
    }
    
    if key not in valid_keys:
        return {"error": f"Invalid status key: {key}"}

    truthy = {"true", "1", "yes", "on"}
    falsy = {"false", "0", "no", "off"}

    value_lower = value.lower()
    if value_lower in truthy:
        bool_value = True
    elif value_lower in falsy:
        bool_value = False
    else:
        return {"error": f"Invalid boolean value: {value}"}
    
    with status_manager._lock:
        setattr(status_manager, key, bool_value)
        thread_manager.wake_all()

    return {
        "message": f"{key} set to {bool_value}",
        "status": {
            key: getattr(status_manager, key)
        }
    }