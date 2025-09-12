import api from "./axiosInstance";

export const getVideoList = async () => {
  const res = await api.get(`/videos`);
  return res.data;
};

export const getFollowingVideoList = async () => {
  const res = await api.get(`/videos/following`);
  return res.data;
};

// 영상 검색
export const searchVideos = async (keyword) => {
  const res = await api.get(`/videos/search?keyword=${keyword}`);
  return res.data;
};

// 영상 업로드
export const uploadVideo = async (formData) => {
  const res = await api.post("/videos", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const getVideoDetail = async (videoId) => {
  const res = await api.get(`/videos/${videoId}`);
  return res.data;
};

export const toggleVideoLike = async (videoId) => {
  const res = await api.post(`/videos/${videoId}/likes`);
  return res.data; // { isLiked: true, likeCount: 12 }
};

// 영상 삭제
export const deleteVideo = async (id) => {
  const response = await api.delete(`/videos/${id}`);
  return response.data;
};

// 영상 수정
export const updateVideo = async (videoId, formData) => {
  const res = await api.put(`/videos/${videoId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};
