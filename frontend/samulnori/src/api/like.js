import axiosInstance from "./axiosInstance";

// 영상 좋아요 상태 확인
export const checkVideoLike = async (videoId) => {
    if (!videoId) {
        throw new Error('Video ID is required');
    }
    
    try {
        const response = await axiosInstance.get(`/like/${videoId}`);
        return response.data; // boolean
    } catch (error) {
        throw error;
    }
};

// 댓글 좋아요 상태 확인
export const checkCommentLike = async (videoId) => {
    if (!videoId) {
        throw new Error('Video ID is required');
    }
    
    try {
        const response = await axiosInstance.get(`/comment/like/${videoId}`);
        return response.data; // List<Long> (댓글 ID 목록)
    } catch (error) {
        throw error;
    }
};