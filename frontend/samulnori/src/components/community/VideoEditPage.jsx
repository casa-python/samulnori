// src/pages/video/VideoEditPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getVideoDetail, updateVideo } from "../../api/video";
import "../../styles/common/VideoEditPage.css";

function VideoEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 폼 상태
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // 영상/썸네일 상태 (File 또는 string URL)
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);

  // ✅ 서버에서 내려준 버전(=updatedAt 문자열) 보관
  const [version, setVersion] = useState(null);

  // 공용: 버전 파라미터 붙이기
  const buildVersionedUrl = (url, v) => {
    if (!url) return null;
    if (!v) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(v)}`;
  };

  // 미리보기용 URL (영상은 string URL만 필요)
  const videoURL = useMemo(() => {
    if (!videoFile) return null;
    if (typeof videoFile === "string") {
      // ✅ 원격 URL에 버전 파라미터
      return buildVersionedUrl(videoFile, version);
    }
    return URL.createObjectURL(videoFile); // 로컬 File -> objectURL
  }, [videoFile, version]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  // 초기 데이터 로드
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const data = await getVideoDetail(id);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setVideoFile(data.videoUrl || null);
        setThumbnailFile(data.thumbnailUrl || null);
        // ✅ updatedAt 보관 (백엔드 DTO가 문자열로 내려줌)
        setVersion(data.updatedAt || data.createdAt || null);

        // 기존 영상의 runtime 설정
        if (data.runtime) {
          setVideoDuration(data.runtime);
        }
      } catch {
        alert("영상 정보를 불러오지 못했습니다.");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    fetchVideo();
  }, [id, navigate]);

  // URL.createObjectURL 정리 (로컬 파일일 때만)
  useEffect(() => {
    return () => {
      if (videoFile && videoFile instanceof File) {
        URL.revokeObjectURL(videoURL);
      }
    };
  }, [videoFile, videoURL]);

  // 드래그&드롭/선택으로 영상 교체
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoDuration(null); // 새로운 영상이 선택되면 길이 초기화
    }
  };
  const handleDragOver = (e) => e.preventDefault();
  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoDuration(null); // 새로운 영상이 선택되면 길이 초기화
    }
  };

  // ★ 핵심: crossOrigin을 src보다 먼저 설정 (캔버스 오염 방지)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // 기존 src 초기화
    v.pause();
    v.removeAttribute("src");
    v.load();

    if (!videoURL) return;

    const isRemoteUrl = typeof videoFile === "string" && /^https?:\/\//.test(videoURL);

    if (isRemoteUrl) {
      v.crossOrigin = "anonymous"; // 반드시 src보다 먼저
      v.src = videoURL;
    } else {
      v.crossOrigin = null;
      v.removeAttribute("crossorigin");
      v.src = videoURL;
    }
  }, [videoURL, videoFile]);

  // 현재 프레임을 썸네일로 설정
  const captureThumbnail = async () => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas) return;

    if (vid.readyState < 2) {
      await new Promise((res) => vid.addEventListener("loadeddata", res, { once: true }));
    }

    const w = vid.videoWidth || 1280;
    const h = vid.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(vid, 0, 0, w, h);

    await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("toBlob failed"));
          const file = new File([blob], "thumbnail.png", { type: "image/png" });
          setThumbnailFile(file);
          resolve();
        },
        "image/png",
        0.92
      )
    );
  };

  // URL 또는 File에서 표시용 이름 추출
  const videoDisplayName = useMemo(() => {
    if (!videoFile) return "";
    if (videoFile instanceof File) return videoFile.name;
    try {
      const u = new URL(videoFile);
      const path = u.pathname.split("/").pop();
      return decodeURIComponent(path || "기존 영상");
    } catch {
      return "기존 영상";
    }
  }, [videoFile]);

  // ✅ 썸네일도 버전 파라미터 적용
  const thumbPreviewURL = useMemo(() => {
    if (!thumbnailFile) return null;
    if (thumbnailFile instanceof File) return URL.createObjectURL(thumbnailFile);
    return buildVersionedUrl(thumbnailFile, version); // string URL + 버전
  }, [thumbnailFile, version]);

  useEffect(() => {
    return () => {
      if (thumbnailFile && thumbnailFile instanceof File) {
        URL.revokeObjectURL(thumbPreviewURL);
      }
    };
  }, [thumbnailFile, thumbPreviewURL]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);

    if (videoDuration) {
      formData.append("runtime", Math.round(videoDuration));
    }

    if (videoFile instanceof File) {
      formData.append("videoFile", videoFile);
    }
    if (thumbnailFile instanceof File) {
      formData.append("thumbnailFile", thumbnailFile);
    }

    try {
      setSaving(true);
      const updated = await updateVideo(id, formData);

      setTitle(updated.title ?? title);
      setDescription(updated.description ?? description);
      if (updated.videoUrl) setVideoFile(updated.videoUrl);
      if (updated.thumbnailUrl) setThumbnailFile(updated.thumbnailUrl);
      setVersion(updated.updatedAt || updated.createdAt || Date.now().toString());

      alert("수정이 완료되었습니다.");

      // 수정 완료 후 상세 페이지로 이동
      navigate(`/video/${id}`);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "영상 수정 중 오류가 발생했습니다.";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="edit-loading">로딩 중...</div>;

  return (
    <div className="edit-video-container">
      <h2 className="edit-video-title">영상 수정</h2>

      <form className="edit-form" onSubmit={handleSubmit}>
        {/* 1행 왼쪽: 제목 */}
        <div className="form-left-title">
          <label>
            제목 *
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
        </div>

        {/* 1행 오른쪽: 드롭존(기존 파일명/URL 표시) */}
        <div className="form-right-title">
          <label>
            영상 파일 (선택 시 교체됨)
            <div className={`dropzone ${videoFile ? "has-file" : ""}`} onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => inputRef.current?.click()}>
              {videoFile ? (
                <div>
                  <span>{videoDisplayName}</span>
                  {videoDuration && (
                    <div
                      style={{
                        fontSize: "12px",
                        marginTop: "4px",
                        color: "#8aa4d6",
                      }}
                    >
                      길이: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(0).padStart(2, "0")}
                    </div>
                  )}
                </div>
              ) : (
                <span>여기에 영상을 끌어놓거나 클릭해서 선택하세요</span>
              )}
              <input ref={inputRef} type="file" accept="video/*" onChange={handlePickFile} style={{ display: "none" }} />
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
              // src는 useEffect에서 crossOrigin을 먼저 설정한 뒤 동적으로 지정합니다.
              playsInline
              muted
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
          {thumbPreviewURL ? <img className="thumb-preview" src={thumbPreviewURL} alt="썸네일 미리보기" /> : <div className="thumb-placeholder">썸네일 미리보기</div>}
        </div>

        {/* 4행 왼쪽: 현재 프레임 버튼 */}
        <div className="form-left-thumbnail-btn">
          <button type="button" className="set-thumbnail-btn" onClick={captureThumbnail}>
            현재 프레임을 썸네일로 설정
          </button>
        </div>

        {/* 4행 오른쪽: 저장 버튼 */}
        <div className="form-right-actions">
          <button type="submit" className="edit-save-button" disabled={saving}>
            {saving ? "저장 중..." : "수정"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default VideoEditPage;
