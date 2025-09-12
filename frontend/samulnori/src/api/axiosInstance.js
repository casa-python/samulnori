import axios from "axios";
import { useAuthStore } from "../stores/useAuthStore";


const api = axios.create({
  baseURL: "https://i13a108.p.ssafy.io",
  withCredentials: true,
});

// 요청 인터셉터 (쿠키에서 AccessToken 추출 → Authorization 헤더 추가)
api.interceptors.request.use(
  (config) => {
    const accessToken = getAccessTokenFromCookie();
    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ✅ refresh 요청 자체에는 재시도 안 함
    if (originalRequest.url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    // ✅ 중복 재시도 방지
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // withCredentials 옵션 추가
        await api.post("/auth/refresh", {}, { withCredentials: true });
        console.log("토큰 리프레시 성공");
        return api(originalRequest);
      } catch (refreshError) {
        // refresh 토큰도 만료되었거나 유효하지 않은 경우
        if (refreshError.response?.status === 400 || refreshError.response?.status === 401) {
          useAuthStore.clearUser();
          // 로그인 페이지로 리다이렉트
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 쿠키에서 AccessToken 파싱 함수
function getAccessTokenFromCookie() {
  const cookies = document.cookie.split("; ");
  const accessTokenCookie = cookies.find((row) => row.startsWith("AccessToken="));
  return accessTokenCookie ? accessTokenCookie.split("=")[1] : null;
}

export default api;
