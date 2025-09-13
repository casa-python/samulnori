import cv2
import numpy as np
import mediapipe as mp

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)
mp_draw = mp.solutions.drawing_utils

# HSV 색 범위
COLOR_RANGES = {
    "red":   [([0,120,70],[10,255,255]), ([170,120,70],[179,255,255])],
    "green": [([40,70,70],[80,255,255])],
    "blue":  [([100,150,0],[140,255,255])]
}

def detect_color_center(hsv, ranges):
    mask_total = None
    for lo, hi in ranges:
        lo, hi = np.array(lo,np.uint8), np.array(hi,np.uint8)
        mask = cv2.inRange(hsv, lo, hi)
        mask_total = mask if mask_total is None else cv2.bitwise_or(mask_total, mask)
    cnts, _ = cv2.findContours(mask_total, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 200:  # 너무 작은 건 무시
        return None
    M = cv2.moments(c)
    if M["m00"] == 0: return None
    cx, cy = int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])
    return (cx, cy)

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret: break
    frame = cv2.flip(frame, 1)  # 미러링
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # 색 검출
    centers = {}
    for name, ranges in COLOR_RANGES.items():
        center = detect_color_center(hsv, ranges)
        if center:
            centers[name] = center
            cv2.circle(frame, center, 10, (0,255,0), -1)
            cv2.putText(frame, name, (center[0]+10, center[1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

    # MediaPipe 손 인식
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)
    if results.multi_hand_landmarks:
        for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            # 기본 라벨
            mp_label = handedness.classification[0].label  # 'Left' or 'Right'
            wrist = hand_landmarks.landmark[mp_hands.HandLandmark.WRIST]
            h, w, _ = frame.shape
            wx, wy = int(wrist.x * w), int(wrist.y * h)

            corrected = mp_label  # 초기값
            # wrist 근처 색 기반 보정
            for cname, cpos in centers.items():
                if abs(wx - cpos[0]) < 50 and abs(wy - cpos[1]) < 50:
                    if cname == "red":
                        corrected = "Left"
                    elif cname == "green":
                        corrected = "Right"

            cv2.putText(frame, f"{mp_label} -> {corrected}",
                        (wx, wy-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                        (0,0,255) if mp_label!=corrected else (255,0,0), 2)
            cv2.circle(frame, (wx,wy), 5, (255,255,0), -1)

    cv2.imshow("hand + color", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
