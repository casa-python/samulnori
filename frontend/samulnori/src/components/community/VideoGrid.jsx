import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/common/VideoGrid.css";

function VideoGrid({ videos, onVideoClick, emptyText = "비디오가 없습니다.", horizontal = false }) {
  const navigate = useNavigate();

  const [hoveredVideoId, setHoveredVideoId] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const formatViewCount = (count) => {
    if (!count) return "0";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "";
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}개월 전`;
    return `${Math.floor(diffInSeconds / 31536000)}년 전`;
  };

  return (
    <div className={`video-grid ${horizontal ? 'video-grid-horizontal' : 'video-grid-normal'}`}>
      {videos && videos.length > 0 ? (
        videos.map((video, index) => (
          <div
            className="video-card"
            key={video.id}
            onClick={() => onVideoClick ? onVideoClick(video) : navigate(`/video/${video.id}`)}
            onMouseEnter={() => {
              hoverTimeoutRef.current = setTimeout(() => {
                setHoveredVideoId(video.id);
              }, 1000); // 1초 후 미리보기 시작
            }}
            onMouseLeave={() => {
              clearTimeout(hoverTimeoutRef.current);
              setHoveredVideoId(null);
            }}
          >
            <div className="video-thumbnail-container">
              {hoveredVideoId === video.id ? (
                <video
                  src={video.previewUrl || video.videoUrl} // 미리보기 영상 or 전체 영상
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="video-thumbnail"
                />
              ) : (
                <>
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="video-thumbnail"
                  />
                  <div className="video-duration">
                    {Math.floor(video.runtime / 60)}:{(video.runtime % 60).toFixed(0).padStart(2, '0') || "10:32"}
                  </div>
                </>
              )}
            </div>

            <div className="video-info">
              <div className="video-uploader-avatar">
                {video.uploader?.profileImg ? (
                  <img
                    src={video.uploader.profileImg}
                    alt="업로더 프로필"
                    className="uploader-profile-img"
                  />
                ) : (
                  <div className="uploader-profile-placeholder">
                    {video.uploader?.nickname?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
              </div>

              <div className="video-details">
                <h3 className="video-title">{video.title}</h3>
                <div className="video-meta">
                  <div className="uploader-name">{video.uploader?.nickname}</div>
                  <div className="video-stats">
                    <span className="view-count">조회수 {formatViewCount(video.viewCnt)}회</span>
                    <span className="upload-time">• {formatTimeAgo(video.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* <div className="video-menu">
                <button className="menu-button" onClick={(e) => e.stopPropagation()}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z" />
                  </svg>
                </button>
              </div> */}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" />
            </svg>
          </div>
          <p className="empty-text">{emptyText}</p>
        </div>
      )}
    </div>
  );
}

export default VideoGrid;