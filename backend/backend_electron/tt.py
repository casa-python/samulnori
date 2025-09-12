import cv2
import numpy as np

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

# 테스트할 색: 여기서 바꿔가면서 확인 (예: "blue", "red", "green"...)
color_ranges = {
    "red":    [([0,120,70],[10,255,255]), ([170,120,70],[179,255,255])],
    "blue":   [([100,150,0],[140,255,255])],
    "green":  [([40,70,70],[80,255,255])],
    "yellow": [([20,150,150],[35,255,255])],
    "orange": [([10,150,150],[20,255,255])],
    "magenta":[([140,150,100],[170,255,255])],
    "navy":   [([110,100,50],[130,255,150])],
    "cyan":   [([85,120,60],[100,255,255])],
}

target = "green"   # ← 이 부분만 바꿔가면서 실행

while True:
    ret, frame = cap.read()
    if not ret: break

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # 마스크 만들기 (red처럼 여러 범위일 수도 있음)
    masks = []
    for lo, hi in color_ranges[target]:
        lo = np.array(lo, np.uint8)
        hi = np.array(hi, np.uint8)
        masks.append(cv2.inRange(hsv, lo, hi))
    mask = masks[0]
    for m in masks[1:]:
        mask = cv2.bitwise_or(mask, m)

    cv2.imshow("frame", frame)
    cv2.imshow("mask", mask)

    if cv2.waitKey(1) & 0xFF == 27:  # ESC 종료
        break

cap.release()
cv2.destroyAllWindows()
