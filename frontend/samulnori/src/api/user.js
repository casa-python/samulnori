import api from "./axiosInstance";


export const getMyProfile = async () => {
    const res = await api.get(`/users/me`);
    return res.data;
};

export const updateProfile = async (profileData) => {
    const formData = new FormData();

    // 텍스트 데이터 추가
    if (profileData.nickname) formData.append('nickname', profileData.nickname);
    if (profileData.email) formData.append('email', profileData.email);
    if (profileData.introduce) formData.append('introduce', profileData.introduce);
    if (profileData.currentPassword) formData.append('currentPassword', profileData.currentPassword);
    if (profileData.newPassword) formData.append('newPassword', profileData.newPassword);

    // 이미지가 있을 때만 추가
    if (profileData.profileImg) {
        formData.append('profileImg', profileData.profileImg);
    }

    console.log(formData);

    return api.put('/users/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const searchUsersByNickname = async (keyword) => {
    const res = await api.get(`/users/search`, {
        params: { keyword }
    });
    return res.data;
};

export const getUserProfile = async (userId) => {
    const res = await api.get(`/users/${userId}/profile`);
    return res.data;
};

export const unSignup = async () => {
    return await api.delete(`/users/me`);
}