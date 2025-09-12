import threading
import cv2
import numpy as np
import mediapipe as mp

from managers.queue_manager import PeekableQueue, SharedAsyncQueue
from managers.status_manager import status_manager
from managers.queue_manager import queue_manager

# HSV 색 범위 정의
COLOR_RANGES = {
    "red":   [([0,120,70],[10,255,255]), ([170,120,70],[179,255,255])],
    "green": [([40,70,70],[80,255,255])],
    "blue":  [([100,150,0],[140,255,255])]
}

def detect_color_centers(frame):
    """
    frame (BGR) -> dict {"red": (x,y) or None, "green": ..., "blue": ...}
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    centers = {}

    for cname, ranges in COLOR_RANGES.items():
        mask_total = None
        for lo, hi in ranges:
            lo, hi = np.array(lo, np.uint8), np.array(hi, np.uint8)
            mask = cv2.inRange(hsv, lo, hi)
            mask_total = mask if mask_total is None else cv2.bitwise_or(mask_total, mask)

        cnts, _ = cv2.findContours(mask_total, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if cnts:
            c = max(cnts, key=cv2.contourArea)
            if cv2.contourArea(c) > 200:  # 노이즈 제거
                M = cv2.moments(c)
                if M["m00"] != 0:
                    cx = int(M["m10"]/M["m00"])
                    cy = int(M["m01"]/M["m00"])
                    centers[cname] = (cx, cy)
                    continue
        centers[cname] = None

    return centers

def _overwrite_labels_with_wristbands(hand_data, color_centers, frame_shape):
    """
    hand_data: [{"label": "left"/"right"/"unknown", "landmarks": [[x,y],..], "fresh": bool}, ...]
    color_centers: {"red": (x,y) or None, "green": (x,y) or None, "blue": (x,y) or None}
    frame_shape: frame.shape
    반환: hand_data (in-place 수정: label_overwritten, label_source, label_before 필드 추가)
    """
    h, w = frame_shape[:2]
    # 화면 크기에 비례한 임계값(프레임 크기 달라도 안정), 필요시 숫자만 살짝 조절
    thresh = 0.1 * min(w, h)  # 예: 1280x720이면 약 43px

    def l2(a, b):
        return ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** 0.5

    red_c   = color_centers.get("red")
    # green_c = color_centers.get("green")
    blue_c = color_centers.get("blue")  # 필요시 추가 활용

    for hd in hand_data:
        if "landmarks" not in hd or not hd["landmarks"]:
            continue
        # 당신이 INDICES=[4,8,12,16,20,0,17]로 구성했으므로 wrist는 인덱스 5번째 원소임
        wrist_xy = hd["landmarks"][5]  # [x, y]
        if wrist_xy is None:
            continue

        cand = []
        if red_c is not None:
            cand.append(("Left", "red",   l2(wrist_xy, red_c)))
        # if green_c is not None:
        #     cand.append(("Right","green", l2(wrist_xy, green_c)))
        if blue_c is not None:
            cand.append(("Right","blue", l2(wrist_xy, blue_c)))

        # 가까운 색이 임계값 안에 있으면 그 색의 라벨로 덮어씀
        if cand:
            cand.sort(key=lambda t: t[2])  # 거리 오름차순
            best_label, src_color, dist = cand[0]
            if dist <= thresh:
                hd["label_before"]    = hd.get("label")
                hd["label"]           = best_label.lower()
                hd["label_overwritten"] = True
                hd["label_source"]    = src_color
            else:
                hd["label_overwritten"] = False
        else:
            hd["label_overwritten"] = False

    return hand_data

def _side_to_band_center(side, centers):
    # 당신 매핑에 맞춤: left=red, right=blue (green 쓰면 여기서 바꾸면 됨)
    return centers.get("red") if side=="left" else centers.get("blue")

def _inject_ghosts(hand_data, cache, color_centers, frame_shape):
    """
    누락된 손을 캐시 기반 평행이동으로 복원.
    """
    h, w = frame_shape[:2]
    present = {h["label"] for h in hand_data if "label" in h}
    for side in ("left", "right"):
        if side in present:  # 이미 검출됨
            continue
        c = cache.get(side)
        if not c: 
            continue

        # 밴드 중심으로 이동량 추정 (없으면 0,0)
        curr_center = _side_to_band_center(side, color_centers)
        if curr_center is not None and c.get("center") is not None:
            dx = curr_center[0] - c["center"][0]
            dy = curr_center[1] - c["center"][1]
        else:
            dx = dy = 0.0

        ghost_lm = [[float(x+dx), float(y+dy)] for (x,y) in c["lm"]]
        hand_data.append({
            "label": side,
            "landmarks": ghost_lm,
            "ghost": True,
            "label_overwritten": False
        })
    return hand_data

class MediaPipeThread:
    def __init__(self):
        self.frame_queue: PeekableQueue = queue_manager.frame_queue
        self.async_hand_queue: SharedAsyncQueue = queue_manager.async_hand_queue
        self.sync_left_hand_queue: PeekableQueue = queue_manager.sync_left_hand_queue
        self.sync_right_hand_queue: PeekableQueue = queue_manager.sync_right_hand_queue
        
        self.hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self._hand_cache = {"left": None, "right": None}

        self.cond = threading.Condition()
        self.thread = threading.Thread(target=self._detection_loop, daemon=True)
        self.thread.start()

        self.mp_hands = mp.solutions.hands
        self.mp_draw = mp.solutions.drawing_utils
    
    def _parse(self, results, frame_shape):
        """
        순서: 엄지TIP(4), 검지TIP(8), 중지TIP(12), 약지TIP(16), 소지TIP(20),
            손바닥(0, WRIST), 손날(17, PINKY_MCP)
        """
        h, w = frame_shape[:2]
        out = []

        if not getattr(results, "multi_hand_landmarks", None):
            return out
        
        INDICES = [4, 8, 12, 16, 20, 0, 17]
        for i, lm_list in enumerate(results.multi_hand_landmarks):
            hd = (results.multi_handedness or [None])[i] if results.multi_handedness else None
            label = (hd.classification[0].label if hd else "Unknown").lower()

            coords = [
                [float(lm_list.landmark[idx].x * w), float(lm_list.landmark[idx].y * h)]
                for idx in INDICES
            ]
            out.append({"label": label, "landmarks": coords})

        return out

    def _detection_loop(self):
        last_ver = 0
        while status_manager.running:
            with self.cond:
                while not status_manager.mediapipe_on and status_manager.running:
                    self.cond.wait()
                if not status_manager.running:
                    break
            
            data, last_ver = self.frame_queue.peek_latest_blocking(last_ver, timeout=1.0)
            if not data:
                continue

            frame, timestamp = data["frame"], data["timestamp"]

            try:
                # 손목밴드 좌표 추출 (RGB 순서)
                rgb_centers = detect_color_centers(frame)

                # BGR → RGB 변환
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                results = self.hands.process(rgb)
                rgb.flags.writeable = True

                # landmark 추출
                hand_data = self._parse(results, frame.shape)

                # ★★★★★ 여기서 손목 밴드 기반 라벨 오버라이트 적용 ★★★★★
                hand_data = _overwrite_labels_with_wristbands(hand_data, rgb_centers, frame.shape)

                # ====== 캐시 업데이트 (검출된 손만) ======
                for hnd in hand_data:
                    if "landmarks" not in hnd or not hnd["landmarks"]:
                        continue
                    side = hnd.get("label")
                    if side not in ("left","right"):
                        continue
                    curr_center = _side_to_band_center(side, rgb_centers)
                    if curr_center is None:
                        continue
                    self._hand_cache[side] = {"lm": hnd["landmarks"], "center": (curr_center[0], curr_center[1])}

                # ====== 고스트 주입 (누락된 손 보강) ======
                hand_data = _inject_ghosts(hand_data, self._hand_cache, rgb_centers, frame.shape)

                # # ---- 디버그 표시 ----
                # dbg = frame.copy()

                # # 1) MediaPipe 랜드마크 그리기
                # if getattr(results, "multi_hand_landmarks", None):
                #     for lm in results.multi_hand_landmarks:
                #         self.mp_draw.draw_landmarks(
                #             dbg, lm, self.mp_hands.HAND_CONNECTIONS,
                #             self.mp_draw.DrawingSpec(color=(0, 255, 255), thickness=2, circle_radius=2),
                #             self.mp_draw.DrawingSpec(color=(255, 255, 255), thickness=2)
                #         )

                # # 2) wrist 주변에 라벨/보정 여부 표기
                # COLOR_LUT = {
                #     "left":  (255, 120, 120),   # BGR(파스텔 레드)
                #     "right": (120, 180, 255),   # BGR(파스텔 오렌지/블루톤)
                #     "?":     (200, 200, 200),
                # }
                # def put_tag(img, text, org, fg=(0,0,0), bg=(255,255,255)):
                #     # 가독성 있는 텍스트 박스
                #     f = cv2.FONT_HERSHEY_SIMPLEX
                #     scale, thick = 0.7, 2
                #     (tw, th), bl = cv2.getTextSize(text, f, scale, thick)
                #     x, y = org
                #     cv2.rectangle(img, (x-4, y-th-8), (x+tw+6, y+6), bg, -1)
                #     cv2.putText(img, text, (x, y), f, scale, fg, thick, cv2.LINE_AA)

                # for h in hand_data:
                #     if "landmarks" not in h or not h["landmarks"]:
                #         continue

                #     wrist = h["landmarks"][5]  # [x, y]
                #     wx, wy = int(wrist[0]), int(wrist[1])
                #     label_now   = h.get("label", "?")
                #     label_prev  = h.get("label_before", label_now)
                #     overwritten = h.get("label_overwritten", False)
                #     source      = h.get("label_source", "mediapipe")
                #     is_ghost    = h.get("ghost", False)

                #     # wrist 표시
                #     cv2.circle(dbg, (wx, wy), 7, (0, 255, 255) if not is_ghost else (180,180,0), -1)
                #     # 라벨 텍스트: "Left -> Right [OVR from green]" 형식
                #     tag = f"{label_prev} -> {label_now}"
                #     if overwritten: tag += f" [OVR:{source}]"
                #     if is_ghost:    tag += " [GHOST]"

                #     bg = (80,250,120) if overwritten else (200,200,200)
                #     if is_ghost:    bg = (50,50,50)
                #     fg = (255,255,255) if is_ghost else (0,0,0)

                #     put_tag(dbg, tag, (wx+10, wy-10), fg=fg, bg=bg)

                # # 2-1) GHOST 랜드마크 그리기
                # for h in hand_data:
                #     if not h.get("ghost", False):
                #         continue
                #     lm = h["landmarks"]
                #     # 점 찍기
                #     for (x, y) in lm:
                #         cv2.circle(dbg, (int(x), int(y)), 3, (0, 200, 200), -1)  # 고스트 점: 시안색 계열
                #     # 선 연결 (간단히 TIP들 연결하거나, MediaPipe CONNECTIONS 따라가도 됨)
                #     for i in range(len(lm)-1):
                #         cv2.line(dbg, (int(lm[i][0]), int(lm[i][1])),
                #                     (int(lm[i+1][0]), int(lm[i+1][1])),
                #                     (0, 180, 180), 1, cv2.LINE_AA)

                # # 3) 색 밴드 중심 그리기 (정확한 BGR로)
                # BAND_BRG = {"red": (0, 0, 255), "green": (0, 255, 0), "blue": (255, 0, 0)}
                # for cname, cpos in rgb_centers.items():
                #     if cpos is None:
                #         continue
                #     cx, cy = cpos
                #     cv2.circle(dbg, (cx, cy), 9, BAND_BRG.get(cname, (255,255,255)), 2)
                #     put_tag(dbg, cname, (cx+10, cy+5), fg=(255,255,255), bg=(50,50,50))

                # cv2.imshow("debug hand + bands", dbg)
                # cv2.waitKey(1)

                # 프론트 전송용 바로 publish
                self.async_hand_queue.put_from_thread(hand_data)

                hands_by_label = {h["label"]: h["landmarks"] for h in hand_data if "landmarks" in h}
                left = hands_by_label.get("left", None)
                right = hands_by_label.get("right", None)
                
                if left is not None:
                    self.sync_left_hand_queue.put({
                        "landmarks": left,
                        "timestamp": timestamp
                    })
                if right is not None:
                    self.sync_right_hand_queue.put({
                        "landmarks": right,
                        "timestamp": timestamp
                    })
            
            except Exception as e:
                print(f"[MediaPipeThread] 핸드 감지 중 오류 발생: {e}")
        
        self.hands.close()
        
    def wake(self):
        with self.cond:
            self.cond.notify()


