import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/useAuthStore";
import { getVideoDetail, toggleVideoLike, deleteVideo } from "../../api/video";
import {
  getParentComments,
  getReplies,
  createComment,
  toggleCommentLike,
  updateComment,
  deleteComment,
} from "../../api/comment";
import { checkVideoLike, checkCommentLike } from "../../api/like";
import Swal from "sweetalert2";

function VideoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [video, setVideo] = useState(null);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [replies, setReplies] = useState({});
  const [expanded, setExpanded] = useState({});
  const [newComment, setNewComment] = useState("");
  const [replyInput, setReplyInput] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyContent, setEditingReplyContent] = useState("");

  const isMyVideo = user && video?.uploader?.id === user.id;

  const promptLogin = async (need = "이 기능을 사용하려면") => {
    const result = await Swal.fire({
      title: "로그인이 필요합니다",
      text: `${need} 로그인이 필요합니다.`,
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "로그인",
      cancelButtonText: "취소",
      reverseButtons: true,
    });
    if (result.isConfirmed) navigate("/login");
    return result.isConfirmed;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getVideoDetail(id);
        setVideo(data);
        setLikeCount(data.likeCnt ?? 0);

        const parentComments = await getParentComments(id);
        setComments(parentComments || []);

        if (user) {
          try {
            const videoLikeStatus = await checkVideoLike(id);
            setIsLiked(Boolean(videoLikeStatus));
            const likedCommentIds = await checkCommentLike(id);
            setComments((prev) =>
              prev.map((c) => ({ ...c, isLiked: likedCommentIds.includes(c.id) }))
            );
          } catch (e) {
            console.error("좋아요 상태 체크 실패:", e);
            setIsLiked(false);
          }
        } else {
          setIsLiked(false);
          setComments((prev) => prev.map((c) => ({ ...c, isLiked: false })));
        }
      } catch {
        alert("비디오 정보를 불러오지 못했습니다.");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate, user]);

  const handleToggleLike = async () => {
    if (!user) {
      await promptLogin("좋아요를 누르려면");
      return;
    }
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((v) => (next ? v + 1 : Math.max(0, v - 1)));
    try {
      const res = await toggleVideoLike(id);
      const finalIsLiked = res.isLiked ?? res.liked;
      const finalLikeCount = res.likeCount ?? res.likes ?? 0;
      setIsLiked(Boolean(finalIsLiked));
      setLikeCount(finalLikeCount);
    } catch (e) {
      console.error("영상 좋아요 에러:", e);
      setIsLiked((v) => !v);
      setLikeCount((v) => (next ? Math.max(0, v - 1) : v + 1));
      alert("좋아요 처리 중 오류");
    }
  };

  const handleDeleteVideo = async () => {
    if (!user) {
      await promptLogin("영상을 삭제하려면");
      return;
    }
    if (!isMyVideo) {
      await Swal.fire({
        title: "삭제 권한 없음",
        text: "본인이 업로드한 영상만 삭제할 수 있습니다.",
        icon: "warning",
        confirmButtonText: "확인",
      });
      return;
    }
    const result = await Swal.fire({
      title: "영상 삭제",
      text: "정말로 이 영상을 삭제하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
      confirmButtonColor: "#d33",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    try {
      await deleteVideo(id);
      await Swal.fire({ title: "삭제 완료", icon: "success", confirmButtonText: "확인" });
      navigate("/");
    } catch (error) {
      console.error("영상 삭제 오류:", error);
      await Swal.fire({
        title: "삭제 실패",
        text: error.response?.data?.message || error.message || "영상 삭제 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonText: "확인",
      });
    }
  };

  const handleToggleReplies = async (parentId) => {
    if (expanded[parentId]) {
      setExpanded((p) => ({ ...p, [parentId]: false }));
      return;
    }
    try {
      const data = await getReplies(id, parentId);
      setReplies((p) => ({ ...p, [parentId]: data || [] }));
      setExpanded((p) => ({ ...p, [parentId]: true }));
    } catch {
      alert("대댓글 불러오기 실패");
    }
  };

  const handleCommentSubmit = async () => {
    if (!user) {
      await promptLogin("댓글을 작성하려면");
      return;
    }
    if (!newComment.trim()) return;
    try {
      const comment = await createComment(id, { content: newComment.trim() });
      setComments((prev) => [comment, ...prev]);
      setNewComment("");
    } catch {
      alert("댓글 작성 실패");
    }
  };

  const handleReplySubmit = async (parentId) => {
    if (!user) {
      await promptLogin("답글을 작성하려면");
      return;
    }
    const content = replyInput[parentId]?.trim();
    if (!content) return;
    try {
      const reply = await createComment(id, { content, parentId });
      setReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] || []), reply] }));
      setReplyInput((prev) => ({ ...prev, [parentId]: "" }));
      if (!expanded[parentId]) setExpanded((prev) => ({ ...prev, [parentId]: true }));
    } catch {
      alert("대댓글 작성 실패");
    }
  };

  const handleToggleCommentLike = async (commentId) => {
    if (!user) {
      await promptLogin("댓글에 좋아요를 누르려면");
      return;
    }
    const target = comments.find((c) => c.id === commentId);
    const origLiked = target?.isLiked || false;
    const origCnt = target?.likeCount || 0;

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, isLiked: !c.isLiked, likeCount: !c.isLiked ? (c.likeCount || 0) + 1 : Math.max(0, (c.likeCount || 0) - 1) }
          : c
      )
    );

    try {
      const res = await toggleCommentLike(commentId);
      const isLiked = Boolean(res);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, isLiked, likeCount: isLiked ? origCnt + 1 : Math.max(0, origCnt - 1) } : c
        )
      );
    } catch (e) {
      console.error("댓글 좋아요 에러:", e);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, isLiked: origLiked, likeCount: origCnt } : c))
      );
      alert("댓글 좋아요 처리 중 오류");
    }
  };

  const handleEditComment = async (commentId) => {
    if (!user) {
      await promptLogin("댓글을 수정하려면");
      return;
    }
    if (!editingContent.trim()) return;
    try {
      await updateComment(id, commentId, { content: editingContent.trim() });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: editingContent.trim() } : c)));
      setEditingCommentId(null);
      setEditingContent("");
    } catch {
      alert("댓글 수정 실패");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!user) {
      await promptLogin("댓글을 삭제하려면");
      return;
    }
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await deleteComment(id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setExpanded((prev) => {
        const copy = { ...prev };
        delete copy[commentId];
        return copy;
      });
      setReplies((prev) => {
        const copy = { ...prev };
        delete copy[commentId];
        return copy;
      });
    } catch {
      alert("댓글 삭제 실패");
    }
  };

  const handleEditReply = async (replyId, parentId) => {
    if (!user) {
      await promptLogin("대댓글을 수정하려면");
      return;
    }
    if (!editingReplyContent.trim()) return;
    try {
      await updateComment(id, replyId, { content: editingReplyContent.trim() });
      setReplies((prev) => ({
        ...prev,
        [parentId]: prev[parentId].map((r) => (r.id === replyId ? { ...r, content: editingReplyContent.trim() } : r)),
      }));
      setEditingReplyId(null);
      setEditingReplyContent("");
    } catch {
      alert("대댓글 수정 실패");
    }
  };

  const handleDeleteReply = async (replyId, parentId) => {
    if (!user) {
      await promptLogin("대댓글을 삭제하려면");
      return;
    }
    if (!window.confirm("대댓글을 삭제하시겠습니까?")) return;
    try {
      await deleteComment(id, replyId);
      setReplies((prev) => ({ ...prev, [parentId]: prev[parentId].filter((r) => r.id !== replyId) }));
    } catch {
      alert("대댓글 삭제 실패");
    }
  };

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(undefined, { notation: "compact", compactDisplay: "short" }),
    []
  );

  if (loading) {
    return (
      <div className="vdp-page vdp-center">
        <style>{styles}</style>
        <div className="vdp-skeleton">
          <div className="vdp-skel-video" />
          <div className="vdp-skel-text" />
          <div className="vdp-skel-row" />
        </div>
      </div>
    );
  }
  if (!video) return <div className="vdp-page vdp-center">비디오를 찾을 수 없습니다.</div>;

  return (
    <div className="vdp-page">
      <style>{styles}</style>
              <div className="vdp-container">

        {/* 왼쪽(유동 폭) + 오른쪽(고정 폭 420px) */}
        <div className="vdp-grid">
          <div className="vdp-media-card sticky">
            <div className="vdp-video-wrap">
              <video src={video.videoUrl} controls className="vdp-video" poster={video.thumbnailUrl} />
            </div>

            <div className="vdp-meta">
              <div className="vdp-meta-row">
                              <div className="vdp-uploader">
                <div 
                  className="vdp-avatar clickable" 
                  aria-hidden
                  onClick={() => navigate(`/user/${video.uploader?.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {video.uploader?.profileImg ? (
                    <img src={video.uploader.profileImg} alt={`${video.uploader.nickname}의 프로필`} className="vdp-avatar-img" />
                  ) : (
                    <div className="vdp-avatar-fallback">{video.uploader?.nickname?.[0]?.toUpperCase() || "U"}</div>
                  )}
                </div>
                <div className="vdp-uploader-texts">
                  <h1 className="vdp-video-title" title={video.title}>{video.title}</h1>
                  <div className="vdp-uploader-name">{video.uploader?.nickname}</div>
                  <div className="vdp-sub">
                    <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                    <span className="vdp-dot">·</span>
                    <span>조회수 {numberFmt.format(video.viewCnt || 0)}</span>
                  </div>
                </div>
              </div>

                <div className="vdp-actions">
                  <button onClick={handleToggleLike} className={`vdp-btn vdp-like ${isLiked ? "is-liked" : ""}`} aria-pressed={isLiked}>
                    <span className="vdp-like-heart">{isLiked ? "❤️" : "🤍"}</span>
                    <span>{numberFmt.format(likeCount)}</span>
                  </button>

                  {isMyVideo && (
                    <>
                      <button onClick={() => navigate(`/video/${id}/edit`)} className="vdp-btn vdp-secondary">수정</button>
                      <button onClick={handleDeleteVideo} className="vdp-btn vdp-danger">삭제</button>
                    </>
                  )}
                </div>
              </div>

              {video.description && <div className="vdp-desc" role="note">{video.description}</div>}
            </div>
          </div>

          {/* 오른쪽: 화면 우측 끝에 붙는 댓글 패널 */}
          <section className="vdp-comments scroll">
            <div className="vdp-comments-header">
              <h3>댓글</h3>
              <div className="vdp-count">{numberFmt.format(comments.length)}</div>
            </div>

            <div className="vdp-editor">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 작성하세요..."
                className="vdp-textarea"
                rows={3}
                maxLength={2000}
              />
              <div className="vdp-editor-actions">
                <span className="vdp-hint">{newComment.length}/2000</span>
                <button onClick={handleCommentSubmit} className="vdp-btn vdp-primary">댓글 작성</button>
              </div>
            </div>

            <div className="vdp-list">
              {comments.map((comment) => (
                <article key={comment.id} className="vdp-comment">
                  <div className="vdp-comment-head">
                    <div 
                      className="vdp-avatar sm clickable" 
                      aria-hidden
                      onClick={() => navigate(`/user/${comment?.userId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {comment?.profileImage ? (
                        <img src={comment.profileImage} alt={`${comment.nickname}의 프로필`} className="vdp-avatar-img" />
                      ) : (
                        <div className="vdp-avatar-fallback">{comment?.nickname?.[0]?.toUpperCase() || "U"}</div>
                      )}
                    </div>
                    <div className="vdp-author-wrap">
                      <div className="vdp-author">{comment?.nickname}</div>
                      <div className="vdp-sub">{new Date(comment.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="vdp-comment-body">
                    {editingCommentId === comment.id ? (
                      <div className="vdp-inline-editor">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="vdp-textarea"
                          rows={3}
                        />
                        <div className="vdp-inline-actions">
                          <button onClick={() => handleEditComment(comment.id)} className="vdp-btn vdp-primary">저장</button>
                          <button onClick={() => { setEditingCommentId(null); setEditingContent(""); }} className="vdp-btn vdp-secondary">취소</button>
                        </div>
                      </div>
                    ) : (
                      <p className="vdp-content">{comment.content}</p>
                    )}
                  </div>

                  <div className="vdp-comment-actions">
                    <button onClick={() => handleToggleCommentLike(comment.id)} className={`vdp-chip ${comment.isLiked ? "is-liked" : ""}`} aria-pressed={comment.isLiked}>
                      {comment.isLiked ? "❤️" : "🤍"} {numberFmt.format(comment.likeCount || 0)}
                    </button>

                    <button onClick={() => handleToggleReplies(comment.id)} className="vdp-chip" aria-expanded={!!expanded[comment.id]}>
                      {expanded[comment.id] ? "답글 숨기기" : "답글 보기"} {replies[comment.id]?.length ? `(${replies[comment.id].length})` : ""}
                    </button>

                    {Number(comment?.userId) === Number(user?.id) && (
                      <div className="vdp-right-actions">
                        <button onClick={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }} className="vdp-link">수정</button>
                        <button onClick={() => handleDeleteComment(comment.id)} className="vdp-link danger">삭제</button>
                      </div>
                    )}
                  </div>

                  {expanded[comment.id] && (
                    <div className="vdp-replies">
                      {(replies[comment.id] || []).map((reply) => (
                        <div key={reply.id} className="vdp-reply">
                          <div className="vdp-comment-head">
                                                      <div 
                            className="vdp-avatar sm clickable" 
                            aria-hidden
                            onClick={() => navigate(`/user/${reply?.userId}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            {reply?.profileImage ? (
                              <img src={reply.profileImage} alt={`${reply.nickname}의 프로필`} className="vdp-avatar-img" />
                            ) : (
                              <div className="vdp-avatar-fallback">{reply?.nickname?.[0]?.toUpperCase() || "U"}</div>
                            )}
                          </div>
                            <div className="vdp-author-wrap">
                              <div className="vdp-author">{reply?.nickname}</div>
                              <div className="vdp-sub">{new Date(reply.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>

                          <div className="vdp-comment-body">
                            {editingReplyId === reply.id ? (
                              <div className="vdp-inline-editor">
                                <textarea
                                  value={editingReplyContent}
                                  onChange={(e) => setEditingReplyContent(e.target.value)}
                                  className="vdp-textarea"
                                  rows={2}
                                />
                                <div className="vdp-inline-actions">
                                  <button onClick={() => handleEditReply(reply.id, comment.id)} className="vdp-btn vdp-primary">저장</button>
                                  <button onClick={() => { setEditingReplyId(null); setEditingReplyContent(""); }} className="vdp-btn vdp-secondary">취소</button>
                                </div>
                              </div>
                            ) : (
                              <p className="vdp-content">{reply.content}</p>
                            )}
                          </div>

                          {Number(reply?.userId) === Number(user?.id) && (
                            <div className="vdp-right-actions pad">
                              <button onClick={() => { setEditingReplyId(reply.id); setEditingReplyContent(reply.content); }} className="vdp-link">수정</button>
                              <button onClick={() => handleDeleteReply(reply.id, comment.id)} className="vdp-link danger">삭제</button>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="vdp-editor compact">
                        <textarea
                          value={replyInput[comment.id] || ""}
                          onChange={(e) => setReplyInput((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                          placeholder="답글을 작성하세요..."
                          className="vdp-textarea"
                          rows={2}
                        />
                        <div className="vdp-editor-actions">
                          <button onClick={() => handleReplySubmit(comment.id)} className="vdp-btn vdp-primary">답글 작성</button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = `
/* ===== VideoDetailPage (scoped) ===== */
.vdp-page{
  min-height:100vh; width:100vw;
  background:#050507; color:#e8e8ea; position:relative;
  padding-top:140px;
}
.vdp-center{display:flex;align-items:center;justify-content:center;min-height:60vh;}
.vdp-container{
  position:relative; z-index:5;
  width:100%;               /* 전체 폭 사용 */
  max-width:none;           /* 중앙 고정폭 해제 */
  margin:0;                 /* 좌우 여백 제거 */
  padding:0 64px 120px;     /* 좌우 공백 증가 */
  padding-left: max(32px, env(safe-area-inset-left));
  padding-right:max(32px, env(safe-area-inset-right));
}

/* Video Title */
.vdp-video-title{
  font-size:clamp(20px,3vw,28px);
  font-weight:700;
  margin:0 0 8px 0;
  line-height:1.3;
  color:#e8e8ea;
  word-wrap:break-word;
  overflow-wrap:break-word;
}

/* Grid */
.vdp-grid{ display:grid; grid-template-columns:1fr; gap:16px; align-items:start; }

/* Desktop: 왼쪽 유동, 오른쪽 고정 420px → 오른쪽 끝에 붙음 */
@media (min-width: 1100px){
  .vdp-grid{
    grid-template-columns: minmax(0,1fr) 420px;
    gap: 20px;
  }
  .vdp-media-card.sticky{
    position: sticky;
    top: 80px;
    z-index: 2;
  }
  .vdp-comments.scroll{
    max-height: calc(100vh - 120px);
    overflow:auto;
    padding-right:2px;
  }
  .vdp-comments.scroll::-webkit-scrollbar{ width:8px; }
  .vdp-comments.scroll::-webkit-scrollbar-thumb{ background:#2a2a3b; border-radius:8px; }
}

/* Media card */
.vdp-media-card{
  background:linear-gradient(180deg, rgba(21,22,32,.85), rgba(13,14,22,.9));
  border:1px solid #262739; border-radius:18px; overflow:clip; box-shadow:0 10px 30px rgba(0,0,0,.35);
}
.vdp-video-wrap{ background:#000; }
.vdp-video{ width:100%; max-height:72vh; object-fit:contain; display:block; background:#000; }
.vdp-meta{ padding:14px 16px 18px; }
.vdp-meta-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.vdp-uploader{ display:flex; align-items:center; gap:12px; min-width:220px; }

.vdp-avatar{ 
  width:42px; height:42px; border-radius:50%; 
  background:linear-gradient(135deg,#2d2f49,#171929); 
  border:1px solid #2a2a3b; 
  display:flex; align-items:center; justify-content:center; 
  font-weight:700; color:#b9b9d9; overflow:hidden; 
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.vdp-avatar.clickable:hover{
  transform: scale(1.05);
  border-color: #3a3d67;
}
.vdp-avatar.sm{ width:34px; height:34px; font-size:12px; }
.vdp-avatar-img{ width:100%; height:100%; object-fit:cover; border-radius:50%; }
.vdp-avatar-fallback{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:700; color:#b9b9d9; }

.vdp-uploader-texts{ 
  display:flex; 
  flex-direction:column; 
  flex:1;
  min-width:0;
}
.vdp-uploader-name{ font-weight:700; letter-spacing:.2px; }
.vdp-sub{ color:#a2a3bb; font-size:12px; }
.vdp-dot{ padding:0 6px; color:#5e6078; }

.vdp-actions{ display:flex; align-items:center; gap:8px; }
.vdp-btn{
  height:36px; padding:0 14px; border-radius:10px; background:#151626; color:#d9daef; border:1px solid #2a2a3b;
  cursor:pointer; font-weight:600; letter-spacing:.2px; display:flex; align-items:center; gap:8px;
  transition:transform .06s ease, background .2s ease, border-color .2s ease;
}
.vdp-btn:hover{ background:#1a1c2d; border-color:#343651; }
.vdp-btn:active{ transform:translateY(1px); }
.vdp-primary{ background:#2b2ee3; border-color:#3436f0; }
.vdp-primary:hover{ background:#3b3ef2; }
.vdp-secondary{ background:#121223; }
.vdp-danger{ background:#2a1216; color:#ffb7c0; border-color:#4b1b23; }
.vdp-danger:hover{ background:#3a171d; }

.vdp-like{ min-width:92px; justify-content:center; }
.vdp-like-heart{ font-size:18px; transform-origin:center; }
.vdp-like.is-liked .vdp-like-heart{ animation:vdp-pop .25s ease; }
@keyframes vdp-pop{ 0%{transform:scale(.9)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }

.vdp-desc{ margin-top:12px; padding:12px 14px; background:rgba(10,11,18,.6); border:1px solid #24263a; border-radius:12px; line-height:1.6; color:#cfd0e6; }

/* Comments */
.vdp-comments{ margin-top:0; }
.vdp-comments-header{ display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.vdp-comments-header h3{ margin:0; font-size:18px; }
.vdp-count{ background:#151626; border:1px solid #2a2a3b; color:#c9c9e0; height:26px; padding:0 8px; border-radius:8px; display:flex; align-items:center; font-size:12px; }

.vdp-editor{ background:rgba(12,13,20,.7); border:1px solid #24263a; border-radius:14px; padding:12px; margin-bottom:12px; }
.vdp-editor.compact{ padding:10px; }
.vdp-textarea{ width:100%; background:#0e0f16; border:1px solid #2a2a3b; border-radius:10px; color:#e7e7fb; padding:10px 12px; resize:vertical; outline:none; }
.vdp-textarea:focus{ border-color:#3a3d67; box-shadow:0 0 0 3px rgba(62,65,120,.25); }
.vdp-editor-actions{ margin-top:8px; display:flex; align-items:center; justify-content:space-between; }
.vdp-hint{ color:#8f90a8; font-size:12px; }

.vdp-list{ display:flex; flex-direction:column; gap:10px; }
.vdp-comment{ background:rgba(14,15,24,.6); border:1px solid #24263a; border-radius:14px; padding:12px; }
.vdp-comment-head{ display:flex; align-items:center; gap:10px; }
.vdp-author-wrap{ display:flex; flex-direction:column; }
.vdp-author{ font-weight:700; }
.vdp-comment-body{ margin-top:8px; }
.vdp-content{ margin:0; line-height:1.65; color:#dbdbf0; }

.vdp-inline-editor{ display:flex; flex-direction:column; gap:8px; }
.vdp-inline-actions{ display:flex; gap:8px; }

.vdp-comment-actions{ margin-top:10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.vdp-right-actions{ margin-left:auto; display:flex; gap:12px; }
.vdp-right-actions.pad{ margin-left:0; }
.vdp-link{ background:transparent; border:none; color:#9aa0ff; cursor:pointer; padding:0; }
.vdp-link:hover{ text-decoration:underline; }
.vdp-link.danger{ color:#ff8da1; }

.vdp-chip{
  height:30px; padding:0 10px; border-radius:999px; background:#131424; color:#d7d8f2; border:1px solid #2a2a3b;
  cursor:pointer; display:flex; align-items:center; gap:6px;
}
.vdp-chip.is-liked{ background:#1b1530; border-color:#3a2a77; }

.vdp-replies{ margin-top:10px; padding-left:14px; border-left:2px solid #2a2a3b; display:flex; flex-direction:column; gap:8px; }
.vdp-reply{ background:rgba(10,11,18,.55); border:1px solid #24263a; border-radius:12px; padding:10px; }

/* Skeleton */
.vdp-skeleton{ width:100%; max-width:900px; display:flex; flex-direction:column; gap:14px; }
.vdp-skel-video{ height:42vh; background:linear-gradient(90deg,#0c0d14,#101123,#0c0d14); border-radius:16px; animation:vdp-shimmer 1.2s linear infinite; }
.vdp-skel-text{ height:20px; width:60%; border-radius:6px; background:linear-gradient(90deg,#0c0d14,#101123,#0c0d14); animation:vdp-shimmer 1.2s linear infinite; }
.vdp-skel-row{ height:60px; border-radius:12px; background:linear-gradient(90deg,#0c0d14,#101123,#0c0d14); animation:vdp-shimmer 1.2s linear infinite; }
@keyframes vdp-shimmer{ 0%{background-position:-200px 0;} 100%{background-position:200px 0;} }

/* Minor */
@media (min-width: 900px){
  .vdp-meta-row{ gap:16px; }
}
`;

export default VideoDetailPage;
