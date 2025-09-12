import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProfile } from "../../api/user";
import { useAuthStore } from "../../stores/useAuthStore";
import Swal from "sweetalert2";

function OAuth2RedirectHandler() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const hasHandled = useRef(false); // ✅ 중복 실행 방지

  useEffect(() => {

    if (hasHandled.current) return;
    hasHandled.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");

    if (error) {
      console.error("[OAuth] 에러 발견:", error);
      navigate("/login", { replace: true });
      return;
    }

    const handleRedirect = async () => {
      try {
        const profile = await getMyProfile();

        setUser({
          id: profile.id,
          nickname: profile.nickname,
          profileImg: profile.profileImg,
          provider: profile.provider,
        });

        Swal.fire({
          title: "소셜 로그인 성공!",
          icon: "success",
        });

        // 업로드 데이터가 있으면 업로드 페이지로 이동
        try {
          const uploadData = localStorage.getItem('pendingUploadData');
          if (uploadData) {
            const parsedData = JSON.parse(uploadData);
            localStorage.removeItem('pendingUploadData');
            navigate('/upload', { 
              state: parsedData,
              replace: true 
            });
            return;
          }
        } catch (e) {
          console.error('업로드 데이터 처리 실패:', e);
        }

        navigate("/", { replace: true }); // ✅ 반드시 replace 사용
      } catch (err) {
        console.error("[OAuth] 프로필 요청 실패:", err);
        setUser(null);
        navigate("/login", { replace: true });
      }
    };

    handleRedirect();
  }, [navigate, setUser]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      로그인 처리 중입니다...
    </div>
  );
}

export default OAuth2RedirectHandler;