// UploadVideoPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { uploadVideo } from "../../api/video";
import "../../styles/common/UploadVideoPage.css";

function UploadVideoPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  // 페이지를 벗어날 때 자동 선택 상태와 임시 경로를 초기화
  useEffect(() => {
    return () => {
      // 미리보기 URL 해제
      try {
        if (videoURL) URL.revokeObjectURL(videoURL);
      } catch (_) {}
      // 직전 자동 선택용 로컬 저장소 키 제거
      try {
        localStorage.removeItem("lastSavedVideoPath");
        localStorage.removeItem("lastSavedVideoName");
      } catch (_) {}
    };
  }, [videoURL]);

  // Data URL을 직접 File로 변환 (CSP connect-src에 data:를 추가하지 않아도 동작)
  const dataUrlToFile = (dataUrl, fileNameFallback) => {
    try {
      const [meta, base64] = (dataUrl || "").split(",");
      const match = /data:(.*?);base64/.exec(meta || "");
      const mime = match ? match[1] : "application/octet-stream";
      const binary = atob(base64 || "");
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : "bin";
      const name = fileNameFallback || `recording.${ext}`;
      return new File([bytes], name, { type: mime });
    } catch (e) {
      console.error("dataUrlToFile 변환 실패:", e);
      return null;
    }
  };
  // 카메라 저장 직후 넘어온 경우 자동 세팅
  useEffect(() => {
    const state = location.state || {};
    const { videoFilePath, videoBlobUrl, suggestedName } = state;
    (async () => {
      try {
        if (videoFilePath && window.electronAPI?.readFileAsDataUrl) {
          const dataUrl = await window.electronAPI.readFileAsDataUrl(videoFilePath);
          if (dataUrl) {
            const fileName = suggestedName || videoFilePath.split(/[/\\]/).pop() || "recording.mp4";
            const file = dataUrlToFile(dataUrl, fileName);
            if (file) useVideoFile(file);
            return;
          }
        } else if (videoBlobUrl) {
          const res = await fetch(videoBlobUrl);
          const blob = await res.blob();
          const fileName = suggestedName || "recording.webm";
          const file = new File([blob], fileName, { type: blob.type || (fileName.endsWith(".mp4") ? "video/mp4" : "video/webm") });
          useVideoFile(file);
          return;
        }

        // localStorage에서 pendingUploadData 확인 (로그인 후 업로드)
        try {
          const pendingData = localStorage.getItem("pendingUploadData");
          if (pendingData) {
            const parsedData = JSON.parse(pendingData);
            if (parsedData.videoFilePath && window.electronAPI?.readFileAsDataUrl) {
              const dataUrl = await window.electronAPI.readFileAsDataUrl(parsedData.videoFilePath);
              if (dataUrl) {
                const fileName = parsedData.suggestedName || parsedData.videoFilePath.split(/[/\\]/).pop() || "recording.mp4";
                const file = dataUrlToFile(dataUrl, fileName);
                if (file) {
                  useVideoFile(file);
                  localStorage.removeItem("pendingUploadData");
                  return;
                }
              }
            }
          }
        } catch (e) {
          console.error("pendingUploadData 처리 실패:", e);
        }

        // 네비게이션 state가 비어있는 경우: 로컬스토리지 백업 사용
        const savedPath = localStorage.getItem("lastSavedVideoPath");
        const savedName = localStorage.getItem("lastSavedVideoName") || "recording.mp4";
        if (savedPath && window.electronAPI?.readFileAsDataUrl) {
          const dataUrl2 = await window.electronAPI.readFileAsDataUrl(savedPath);
          if (dataUrl2) {
            const file2 = dataUrlToFile(dataUrl2, savedName);
            if (file2) useVideoFile(file2);
          }
        }
      } catch (e) {
        console.error("자동 입력 실패:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useVideoFile = (file) => {
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setVideoDuration(null); // 새로운 영상이 선택되면 길이 초기화
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) useVideoFile(file);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) useVideoFile(file);
  };

  const captureThumbnail = () => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas) return;

    const w = vid.videoWidth || 1280;
    const h = vid.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(vid, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "thumbnail.png", { type: "image/png" });
        setThumbnailFile(file);
      },
      "image/png",
      0.92
    );
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !videoFile || !thumbnailFile) {
      alert("제목, 영상 파일, 썸네일은 필수입니다.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("videoFile", videoFile);
    formData.append("thumbnailFile", thumbnailFile);

    // runtime이 있을 때만 추가
    if (videoDuration) {
      formData.append("runtime", Math.round(videoDuration));
    }

    try {
      setUploading(true);
      const res = await uploadVideo(formData);
      alert("영상이 성공적으로 업로드되었습니다!");
      navigate(`/video/${res.id}`);
    } catch (err) {
      console.error("업로드 실패:", err);

      // 백엔드에서 보낸 에러 메시지가 있으면 표시
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "영상 업로드 중 오류가 발생했습니다.";
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-video-container">
      <h2 className="upload-video-title">영상 업로드</h2>

      <form className="upload-form" onSubmit={handleUpload}>
        {/* 1행 왼쪽: 제목 */}
        <div className="form-left-title">
          <label>
            제목 *
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
        </div>

        {/* 1행 오른쪽: 드롭존(파일명) */}
        <div className="form-right-title">
          <label>
            영상 파일 *
            <div className={`dropzone ${videoFile ? "has-file" : ""}`} onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => inputRef.current?.click()}>
              {videoFile ? (
                <div>
                  <span>{videoFile.name}</span>
                  {videoDuration && (
                    <div style={{ fontSize: "12px", marginTop: "4px", color: "#8aa4d6" }}>
                      길이: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(0).padStart(2, "0")}
                    </div>
                  )}
                </div>
              ) : (
                <span>여기에 영상을 끌어놓거나 클릭해서 선택하세요</span>
              )}
              <input ref={inputRef} type="file" accept="video/*" onChange={handlePickFile} style={{ display: "none" }} required={!videoFile} />
            </div>
          </label>
        </div>

        {/* 2행 왼쪽: 설명 */}
        <div className="form-left-description">
          <label>
            설명
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        {/* 2~3행 오른쪽: 영상 미리보기(없어도 자리 유지) */}
        <div className="form-right-preview">
          {videoURL ? (
            <video
              ref={videoRef}
              src={videoURL}
              controls
              className="preview-video"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setVideoDuration(videoRef.current.duration);
                }
              }}
            />
          ) : (
            <div className="preview-placeholder">영상 미리보기</div>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {/* 3행 왼쪽: 썸네일 미리보기(없어도 자리 유지) */}
        <div className="form-left-thumbnail">
          <div className="thumb-label">썸네일 이미지 *</div>
          {thumbnailFile ? <img className="thumb-preview" src={URL.createObjectURL(thumbnailFile)} alt="thumbnail preview" /> : <div className="thumb-placeholder">썸네일 미리보기</div>}
        </div>

        {/* 4행 왼쪽: 현재 프레임 버튼 */}
        <div className="form-left-thumbnail-btn">
          <button type="button" className="set-thumbnail-btn" onClick={captureThumbnail}>
            현재 프레임을 썸네일로 설정
          </button>
        </div>

        {/* 4행 오른쪽: 업로드 버튼 */}
        <div className="form-right-actions">
          <button type="submit" className="upload-button" disabled={uploading}>
            {uploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UploadVideoPage;
