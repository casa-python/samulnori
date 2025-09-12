from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from managers.queue_manager import queue_manager
import json
import asyncio

router = APIRouter()

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    print("WebSocekt 연결 대기중...")
    await websocket.accept()
    print("WebSocket 연결됨")

    jpeg_queue = queue_manager.async_jpeg_queue
    object_queue = queue_manager.async_object_queue
    hand_queue = queue_manager.async_hand_queue
    event_queue = queue_manager.async_event_queue

    async def send_jpeg():
        while True:
            try:
                data = await jpeg_queue.get_latest()
                if data is not None:
                    await websocket.send_bytes(data)
            except WebSocketDisconnect:
                print("❌ WebSocket disconnected during send_jpeg")
                break
            except Exception as e:
                print(f"JPEG send_bytes error: {e}")
                pass


    async def send_objects():
        while True:
            payload = await object_queue.get_latest()
            objects = payload["objects"]
            if objects is not None:
                try:
                    msg = {
                        "type": "inference",
                        "data": objects
                    }
                    await websocket.send_text(json.dumps(msg))
                except WebSocketDisconnect:
                    print("❌ WebSocket disconnected during send_objects")
                    break
                except Exception as e:
                    print(f"JSON serialization error: {e}")
                    pass
    
    async def send_hand_data():
        while True:
            hands = await hand_queue.get_latest()
            if hands is not None:
                try:
                    msg = {
                        "type": "hand",
                        "data": hands
                    }
                    await websocket.send_text(json.dumps(msg))
                except WebSocketDisconnect:
                    print("❌ WebSocket disconnected during send_hand_data")
                    break
                except Exception as e:
                    print(f"JSON serialization error: {e}")
                    pass
    
    async def send_event_data():
        while True:
            events = await event_queue.get_latest()
            if events is not None:
                try:
                    msg = {
                        "type": "event",
                        "data": events
                    }
                    await websocket.send_text(json.dumps(msg))
                except WebSocketDisconnect:
                    print("❌ WebSocket disconnected during send_event_data")
                    break
                except Exception as e:
                    print(f"JSON serialization error: {e}")
                    pass
    
    async def ping_pong():
        while True:
            try:
                msg = await websocket.receive_text()
                if msg.lower() == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                print("❌ WebSocket disconnected during ping-pong")
                break
            except Exception as e:
                print(f"⚠️ Error in ping-pong: {e}")
                break


    tasks = [
        asyncio.create_task(send_jpeg()),
        asyncio.create_task(send_objects()),
        asyncio.create_task(send_hand_data()),
        asyncio.create_task(send_event_data()),
        asyncio.create_task(ping_pong()),
    ]

    try:
        await asyncio.gather(*tasks)
    except WebSocketDisconnect:
        print("❌ WebSocket disconnected")
    except Exception as e:
        print(f"⚠️ WebSocket error: {e}")
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        print("✅ All tasks cancelled cleanly.")