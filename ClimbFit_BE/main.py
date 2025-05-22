from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
import tempfile
import os
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ A4 인식: HSV 마스킹 → 윤곽선 추출
def get_mm_per_pixel_from_a4(image, debug_output_path=None):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # 흰색 범위 마스크 (밝고 채도 낮은 영역)
    mask = cv2.inRange(hsv, (0, 0, 180), (180, 60, 255))
    result = cv2.bitwise_and(image, image, mask=mask)

    gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 30, 100)

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    approx_a4 = None
    max_area = 0
    for cnt in contours:
        approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
        area = cv2.contourArea(cnt)
        if len(approx) == 4 and area > max_area and area > 20000:
            max_area = area
            approx_a4 = approx

    # 디버깅 이미지 저장
    if debug_output_path is not None:
        debug_img = image.copy()
        if approx_a4 is not None:
            cv2.drawContours(debug_img, [approx_a4], -1, (0, 255, 0), 4)
        else:
            cv2.putText(debug_img, "A4 Not Found", (30, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
        cv2.imwrite(debug_output_path, debug_img)

    if approx_a4 is None:
        raise ValueError("A4 윤곽선을 찾을 수 없습니다.")

    pts = approx_a4.reshape(4, 2)
    pts = sorted(pts, key=lambda x: x[1])  # y좌표 기준 정렬
    height1 = np.linalg.norm(pts[0] - pts[2])
    height2 = np.linalg.norm(pts[1] - pts[3])
    pixel_height = max(height1, height2)

    A4_MM_HEIGHT = 297
    mm_per_pixel = A4_MM_HEIGHT / pixel_height
    return mm_per_pixel

# ✅ 발 윤곽 및 치수 계산
def extract_foot_dimensions(image_path, debug_output_path=None):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("이미지를 열 수 없습니다.")

    mm_per_pixel = get_mm_per_pixel_from_a4(image, debug_output_path)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 160, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    foot_contour = max([c for c in contours if cv2.contourArea(c) > 3000], key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(foot_contour)

    foot_length_mm = h * mm_per_pixel
    foot_width_mm = w * mm_per_pixel

    return round(foot_length_mm, 1), round(foot_width_mm, 1), round(mm_per_pixel, 4)

# ✅ FastAPI 엔드포인트
@app.post("/analyze-foot")
async def analyze_foot(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        debug_path = os.path.join("C:/temp", "a4_debug_result.jpg")
        length_mm, width_mm, scale = extract_foot_dimensions(tmp_path, debug_output_path=debug_path)
        os.remove(tmp_path)

        return {
            "foot_length_mm": length_mm,
            "foot_width_mm": width_mm,
            "mm_per_pixel": scale,
            "a4_debug_image_path": debug_path,
            "models": []
        }

    except Exception as e:
        print("⛔ 예외 발생:")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
