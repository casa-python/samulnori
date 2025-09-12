from typing import List
from fastapi.responses import JSONResponse
from fastapi import APIRouter, Body, HTTPException

from managers.object_manager import object_manager

router = APIRouter()

@router.post("/add")
def add_objects(ids: List[int] = Body(...)):
    added = []
    skipped = []
    for obj_id in ids:
        if obj_id not in object_manager.objects:
            object_manager.add_object(obj_id)
            added.append(obj_id)
        else:
            skipped.append(obj_id)

    return JSONResponse(content={
        "message": f"{len(added)} object(s) added.",
        "added_ids": added,
        "skipped_ids": skipped
    })

@router.post("/remove")
def remove_objects(ids: List[int] = Body(...)):
    removed = []
    not_found = []

    for obj_id in ids:
        if obj_id in object_manager.objects:
            object_manager.remove_object(obj_id)
            removed.append(obj_id)
        else:
            not_found.append(obj_id)

    return JSONResponse(content={
        "message": f"{len(removed)} object(s) removed.",
        "removed_ids": removed,
        "not_found_ids": not_found
    })

@router.get("")
def get_all_objects():
    """
    현재 트래킹 중인 모든 object_id 목록 반환
    """
    return {"object_ids": object_manager.get_object_ids()}




# ------------------- Object Settings -----------------------

@router.post("/{object_id}/mappings")
def set_mappings(object_id: int, mappings: list = Body(...)):
    """
    요청 본문 예시:
    [
      { "hand": "left",  "sensor_idx": 0, "path": "drums/kick.wav", "volume": 0.9  },
      { "hand": "right", "sensor_idx": 2, "path": "drums/snare.wav", "volume": 1.2 }
    ]
    """
    if object_id not in object_manager.objects:
        raise HTTPException(404, f"Object {object_id} not found")

    try:
        results = object_manager.bulk_set_mappings_by_path(object_id, mappings)
        return JSONResponse(content={"object_id": object_id, "results": results})
    except Exception as e:
        # 예기치 못한 에러는 400으로 묶어서 반환
        raise HTTPException(400, str(e))

@router.get("/{object_id}/mappings")
def get_mappings(object_id: int):
    """
    응답 예시:
    {
      "object_id": 7,
      "mappings": [
        { "hand": "left",  "sensor_idx": 0, "path": "drums/kick.wav", "volume": 0.9  },
        { "hand": "right", "sensor_idx": 2, "path": "drums/snare.wav", "volume": 1.2 }
      ]
    }
    """
    if object_id not in object_manager.objects:
        raise HTTPException(404, f"Object {object_id} not found")
    try:
        mappings = object_manager.get_mappings(object_id)
        return JSONResponse(content={"object_id": object_id, "mappings": mappings})
    except Exception as e:
        raise HTTPException(400, str(e))