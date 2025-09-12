import { Routes, Route } from "react-router-dom";
import SignupPage from "../../components/community/SignupPage";
import LoginPage from "../../components/community/LoginPage";
import HomePage from "../../components/community/HomePage";
import ProfileEditPage from "../../components/community/ProfileEditPage";
import OAuth2RedirectHandler from "../../components/community/OAuth2RedirectHandler";
import UserPage from "../../components/community/UserPage";
import VideoDetailPage from "../../components/community/VideoDetailPage";
import UploadVideoPage from "../../components/community/UploadVideoPage";
import VideoEditPage from "../../components/community/VideoEditPage";

function CommunityRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} /> {/* 홈페이지 */}
      <Route path="/signup" element={<SignupPage />} /> {/* 회원가입 */}
      <Route path="/login" element={<LoginPage />} /> {/* 로그인 */}
      <Route path="/auth/redirect" element={<OAuth2RedirectHandler />} />
      <Route path="/user/:id" element={<UserPage />} />
      <Route path="/profile/edit" element={<ProfileEditPage />} /> {/* 프로필 수정 */}
      <Route path="/video/:id" element={<VideoDetailPage />} /> {/* 비디오 상세 */}
      <Route path="/upload" element={<UploadVideoPage />} /> {/* 업로드 경로 추가 */}
      <Route path="/video/:id/edit" element={<VideoEditPage />} />
    </Routes>
  );
}

export default CommunityRouter;
