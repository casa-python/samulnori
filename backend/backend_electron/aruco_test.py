# aruco_test.py
import cv2
import numpy as np
import time
import os

# =========================
# 설정
# =========================
CAMERA_INDEX = 0
FRAME_WIDTH, FRAME_HEIGHT = 1280, 720
DICT_NAME = "DICT_4X4_50"   # 예: DICT_4X4_50, DICT_5X5_100, DICT_6X6_250, DICT_7X7_1000, DICT_ARUCO_ORIGINAL
MARKER_LENGTH_M = 0.05       # 마커 한 변 길이(미터). 포즈추정용. (캘리브레이션 있을 때만 사용)
CALIB_FILE = "calib.npz"     # numpy savez로 저장된 카메라 행렬/왜곡 파일 (선택)

# =========================
# 유틸: OpenCV 버전별 ArUco 핸들러
# =========================
def get_aruco_modules():
    """
    OpenCV 버전별 aruco API 차이를 흡수하기 위한 래퍼.
    반환:
      dict_obj: 사전(d) 생성 함수
      detector: detector 객체 또는 None
      detect_fn: frame -> (corners, ids, rejected) 반환 함수
      draw_detected: 검출 그리기 함수
      estimate_pose: (corners, markerLength, K, dist) -> (rvecs, tvecs) or None
      draw_axis: 축 그리기 함수
    """
    if not hasattr(cv2, "aruco"):
        raise RuntimeError("cv2.aruco 모듈이 필요합니다. opencv-contrib-python을 설치하세요.")

    aruco = cv2.aruco

    # 사전 가져오기
    def get_dict(name):
        if not name.startswith("DICT_"):
            raise ValueError("사전 이름은 'DICT_*' 형태여야 합니다.")
        if not hasattr(aruco, name):
            raise ValueError(f"지원하지 않는 사전 이름입니다: {name}")
        return aruco.getPredefinedDictionary(getattr(aruco, name))

    # OpenCV 4.7+ 에서는 ArucoDetector 클래스가 있음
    if hasattr(aruco, "ArucoDetector"):
        def make_detector(dictionary):
            params = aruco.DetectorParameters()
            return aruco.ArucoDetector(dictionary, params)

        def detect(detector, frame):
            return detector.detectMarkers(frame)

        def draw_detected(frame, corners, ids, rejected):
            if ids is not None and len(ids) > 0:
                aruco.drawDetectedMarkers(frame, corners, ids)
            # rejected는 굳이 표시 안 함(원하면 drawDetectedMarkers로 다른 색으로 커스텀 가능)

        def estimate_pose(corners, markerLength, K, dist):
            # OpenCV는 여전히 estimatePoseSingleMarkers 함수 제공
            if K is None or dist is None:
                return None, None
            return aruco.estimatePoseSingleMarkers(corners, markerLength, K, dist)

        def draw_axis(frame, K, dist, rvec, tvec, length):
            cv2.drawFrameAxes(frame, K, dist, rvec, tvec, length)

        return get_dict, make_detector, detect, draw_detected, estimate_pose, draw_axis

    # 구버전 경로: 전역 함수 detectMarkers 사용
    else:
        def make_detector(dictionary):
            # 구버전은 별도 detector 객체 없이 params만 사용
            params = aruco.DetectorParameters_create()
            return (dictionary, params)

        def detect(detector, frame):
            dictionary, params = detector
            return aruco.detectMarkers(frame, dictionary, parameters=params)

        def draw_detected(frame, corners, ids, rejected):
            if ids is not None and len(ids) > 0:
                aruco.drawDetectedMarkers(frame, corners, ids)

        def estimate_pose(corners, markerLength, K, dist):
            if K is None or dist is None:
                return None, None
            return aruco.estimatePoseSingleMarkers(corners, markerLength, K, dist)

        def draw_axis(frame, K, dist, rvec, tvec, length):
            cv2.drawFrameAxes(frame, K, dist, rvec, tvec, length)

        return get_dict, make_detector, detect, draw_detected, estimate_pose, draw_axis


# =========================
# 마커 이미지 생성 (인쇄용)
# =========================
def save_marker_png(dict_name=DICT_NAME, marker_id=0, pixels=600, out="aruco_marker.png"):
    get_dict, *_ = get_aruco_modules()
    dictionary = get_dict(dict_name)
    img = cv2.aruco.generateImageMarker(dictionary, marker_id, pixels)
    cv2.imwrite(out, img)
    print(f"[+] 저장 완료: {out} (dict={dict_name}, id={marker_id}, size={pixels}px)")


# =========================
# 메인
# =========================
def main():
    get_dict, make_detector, detect, draw_detected, estimate_pose, draw_axis = get_aruco_modules()

    # 사전 선택
    dictionary = get_dict(DICT_NAME)
    detector = make_detector(dictionary)

    # 카메라 열기
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)  # 윈도우라면 CAP_DSHOW가 안정적일 때가 많음
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, 60)

    if not cap.isOpened():
        raise RuntimeError(f"웹캠을 열 수 없습니다 (index={CAMERA_INDEX})")

    # 캘리브레이션 파일이 있으면 로드 (포즈추정 활성화)
    K, dist = None, None
    if os.path.exists(CALIB_FILE):
        data = np.load(CALIB_FILE)
        K = data.get("camera_matrix", None)
        dist = data.get("dist_coeffs", None)
        if K is not None and dist is not None:
            print("[i] 캘리브레이션 로드됨 → 포즈추정 활성화")
        else:
            print("[i] 캘리브레이션 파일 형식이 올바르지 않습니다. 포즈추정 비활성화")

    print("[키 안내] q: 종료 | s: 현재 프레임 저장 | g: 마커 PNG 생성 | d: 사전 순환")
    dict_cycle = [
        "DICT_4X4_50", "DICT_5X5_100", "DICT_6X6_250", "DICT_7X7_1000", "DICT_ARUCO_ORIGINAL"
    ]
    dict_idx = dict_cycle.index(DICT_NAME) if DICT_NAME in dict_cycle else 0

    prev_t = time.perf_counter()
    fps_ema = 30.0

    while True:
        ok, frame = cap.read()
        if not ok:
            print("[!] 프레임 획득 실패")
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 검출
        corners, ids, rejected = detect(detector, gray)

        # 표시
        draw_detected(frame, corners, ids, rejected)

        # 포즈추정(선택)
        if ids is not None and len(ids) > 0 and K is not None and dist is not None:
            rvecs, tvecs = estimate_pose(corners, MARKER_LENGTH_M, K, dist)
            if rvecs is not None and tvecs is not None:
                for rvec, tvec in zip(rvecs, tvecs):
                    draw_axis(frame, K, dist, rvec, tvec, MARKER_LENGTH_M * 0.5)

                # 첫 번째 마커의 거리/각도 텍스트
                t = tvecs[0].reshape(-1)
                dist_m = np.linalg.norm(t)
                cv2.putText(frame, f"dist: {dist_m:.3f} m",
                            (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2, cv2.LINE_AA)

        # FPS 표시
        now = time.perf_counter()
        dt = now - prev_t
        prev_t = now
        fps = 1.0 / dt if dt > 0 else 0.0
        fps_ema = 0.9 * fps_ema + 0.1 * fps
        cv2.putText(frame, f"FPS: {fps_ema:.1f}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50,220,50), 2, cv2.LINE_AA)

        # ID 텍스트 표시
        if ids is not None and len(ids) > 0:
            for c, i in zip(corners, ids.flatten()):
                c = c.reshape(-1, 2).astype(int)
                cx, cy = c.mean(axis=0).astype(int)
                cv2.putText(frame, f"ID:{i}", (cx, cy),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 80, 80), 2, cv2.LINE_AA)

        cv2.imshow("ArUco Test", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        elif key == ord('s'):
            fn = f"frame_{int(time.time())}.jpg"
            cv2.imwrite(fn, frame)
            print(f"[+] 프레임 저장: {fn}")
        elif key == ord('g'):
            # 현재 사전 기준 마커 0번 PNG 저장
            save_marker_png(dict_cycle[dict_idx], marker_id=0, pixels=800, out="aruco_marker.png")
        elif key == ord('d'):
            # 사전 순환 변경
            dict_idx = (dict_idx + 1) % len(dict_cycle)
            new_name = dict_cycle[dict_idx]
            print(f"[i] 사전 변경: {new_name}")
            dictionary = get_dict(new_name)
            detector = make_detector(dictionary)

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
