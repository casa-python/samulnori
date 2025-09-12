import api from "./axiosInstance";

export const followUser = async (followeeId) => {
    return await api.post(`/follow/${followeeId}`, {}, 
        {withCredentials : true}
    );
}

export const unfollowUser = async (followeeId) => {
    return await api.delete(`/follow/${followeeId}`, {}, 
        {withCredentials : true}
    );
}

export const getFollowings = async (userId) => {
    const res = await api.get(`/follow/followings/${userId}`, {},
        {withCredentials : true}
    );
    return res.data;
}

export const getFollowers = async (userId) => {
    const res = await api.get(`/follow/followers/${userId}`, {},
        {withCredentials : true}
    );
    return res.data;
}