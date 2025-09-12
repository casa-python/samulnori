import api from "./axiosInstance";

// 부모 댓글 조회
export const getParentComments = async (videoId) => {
  const res = await api.get(`/videos/${videoId}/comments`);
  return res.data;
};

// 대댓글 조회
export const getReplies = async (videoId, parentId) => {
  const res = await api.get(`/videos/${videoId}/comments/${parentId}/replies`);
  return res.data;
};

// 댓글 작성
export const createComment = async (videoId, commentData) => {
  const res = await api.post(`/videos/${videoId}/comments`, commentData);
  return res.data;
};

// 댓글 좋아요 토글
export const toggleCommentLike = async (commentId) => {
  const res = await api.post(`/comments/${commentId}/likes`);
  return res.data; // { commentId, isLiked, likeCount }
};

// 댓글 수정
export const updateComment = async (videoId, commentId, { content }) => {
  const res = await api.put(`/videos/${videoId}/comments/${commentId}`, { content });
  return res.data;
};

// 댓글 삭제
export const deleteComment = async (videoId, commentId) => {
  const res = await api.delete(`/videos/${videoId}/comments/${commentId}`);
  return res.status === 204;
};
