import api from "./axiosInstance";
import { useAuthStore } from "../stores/useAuthStore";

const API = 'http://i13a108.p.ssafy.io';

export const loginWithGoogle = () => {
  window.location.href = `${API}/oauth2/authorization/google`;
};

export const loginWithNaver = () => {
  window.location.href = `${API}/oauth2/authorization/naver`;
};

export const loginWithKakao = () => {
  window.location.href = `${API}/oauth2/authorization/kakao`;
};

export const logout = async () => {
  try {
    const res = await api.post(`/auth/logout`, {}, {
      withCredentials: true
    });

    useAuthStore.getState().clearUser();

    return res.data;
  } catch (error) {
    console.error('로그아웃 실패:', error);
    throw error;
  }
};

export const signup = async ({ email, password, nickname, profileImg }) => {

  const formData = new FormData();
  formData.append('email', email);
  formData.append('password', password);
  formData.append('nickname', nickname);
  formData.append('profileImg', profileImg);
  return await api.post(`/auth/signup`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const login = async ({ email, password }) => {
  const res = await api.post(
    `/auth/login`,
    { email, password },
    { withCredentials: true }
  );
  return res;
};


