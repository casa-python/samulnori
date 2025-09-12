import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProfile, updateProfile, unSignup } from "../../api/user";
import { useAuthStore } from "../../stores/useAuthStore";
import Swal from "sweetalert2";

function ProfileEditPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    introduce: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [profileImg, setProfileImg] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getMyProfile();
        setUserProfile(profile);
        setFormData(prev => ({
          ...prev,
          nickname: profile.nickname,
          email: profile.email,
          introduce: profile.introduce || ""
        }));
        setPreviewUrl(profile.profileImg || null);
        setProvider(profile.provider);
      } catch (error) {
        console.error("프로필 조회 실패:", error);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfileImg(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setPasswordError("");

    try {
      if (showPasswordChange && formData.newPassword !== formData.confirmPassword) {
        setPasswordError("새 비밀번호가 일치하지 않습니다.");
        setSaving(false);
        return;
      }

      const payload = {
        email: formData.email,
        nickname: formData.nickname,
        introduce: formData.introduce,
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        profileImg: profileImg
      };

      await updateProfile(payload);
      Swal.fire({
        title: "프로필이 성공적으로 수정되었습니다!",
        icon: "success",
        confirmButtonText: "확인",
        confirmButtonColor: "#2C6FAA",
        cancelButtonColor: "#6B7280",
      });
      navigate("/profile/edit");
    } catch (error) {
      
      Swal.fire({
        title: "프로필 수정에 실패했습니다.",
        icon: "error",
        confirmButtonText: "확인",
        confirmButtonColor: "#2C6FAA",
        cancelButtonColor: "#6B7280",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    Swal.fire({
      title: "정말로 회원탈퇴 하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "확인",
      cancelButtonText: "취소",
      confirmButtonColor: "#2C6FAA",
      cancelButtonColor: "#6B7280",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await unSignup();
          useAuthStore.getState().clearUser();
          Swal.fire({
            title: "회원탈퇴가 완료되었습니다.",
            icon: "success",
          }).then(() => {
            navigate("/login");
          });
        } catch (e) {
          Swal.fire({
            title: "회원탈퇴에 실패했습니다.",
            icon: "error",
          });
        }
      }
    });
  };

  if (loading) return <div style={{ color: "#fff", textAlign: "center", paddingTop: "100px" }}>로딩 중...</div>;
  if (!userProfile) return <div style={{ color: "#fff", textAlign: "center", paddingTop: "100px" }}>사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div style={{
      background: "#000",
      minHeight: '100vh',
      width: '100vw',
      color: "#fff",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      padding: "40px 20px",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#111",
        borderRadius: "16px",
        padding: "36px 30px",
        maxWidth: "520px",
        width: "100%",
        zIndex: 10,
        boxShadow: "0 0 20px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        gap: "18px"
      }}>
        <h2 style={{ textAlign: "center", fontSize: "1.7rem", fontWeight: 800 }}>프로필 관리</h2>

        {/* 프로필 이미지 */}
        <label style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block", cursor: "pointer" }}>
            <div style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "linear-gradient(135deg, #F6E05E, #E53E3E, #EC4899)",
              padding: "3px",
              margin: "0 auto 10px"
            }}>
              <img
                src={previewUrl || "https://via.placeholder.com/120x120?text=👤"}
                alt="프로필"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  background: "#000"
                }}
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "0.9rem", color: "#aaa" }}>프로필 이미지 클릭하여 변경</div>
          </div>
        </label>

        {/* 텍스트 필드들 */}
        <Field label="닉네임" name="nickname" value={formData.nickname} onChange={handleChange} disabled={provider !== "local"} />
        <Field label="이메일" name="email" value={formData.email} onChange={handleChange} disabled={provider !== "local"} type="email" />
        <Field label="소개" name="introduce" value={formData.introduce} onChange={handleChange} isTextArea={true} />

        {/* 비밀번호 변경 토글 */}
        {provider === "local" && (
          <button type="button" onClick={() => setShowPasswordChange(p => !p)} style={{ ...btnStyle, background: "#3B82F6", color: "#fff" }}>
            {showPasswordChange ? "비밀번호 변경 취소" : "비밀번호 변경"}
          </button>
        )}

        {/* 비밀번호 입력 필드 */}
        {showPasswordChange && (
          <>
            <Field label="현재 비밀번호" name="currentPassword" value={formData.currentPassword} onChange={handleChange} type="password" />
            <Field label="새 비밀번호" name="newPassword" value={formData.newPassword} onChange={handleChange} type="password" />
            <Field label="새 비밀번호 확인" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} type="password" />
            {passwordError && <div style={{ color: "#F87171" }}>{passwordError}</div>}
          </>
        )}

        {/* 버튼들 */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button type="submit" disabled={saving} style={{ ...btnStyle, background: "#4FD1C5", color: "#000" }}>{saving ? "저장 중..." : "저장"}</button>
          <button type="button" onClick={() => navigate(`/user/${userProfile.id}`)} style={{ ...btnStyle, background: "#6B7280", color: "#fff" }}>내 페이지</button>
        </div>

        <button type="button" onClick={handleDeleteAccount} style={{ ...btnStyle, background: "#EF4444", color: "#fff" }}>
          회원탈퇴
        </button>
      </form>
    </div>
  );
}

export default ProfileEditPage;

function Field({ label, name, value, onChange, disabled = false, type = "text", isTextArea = false }) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>{label}</label>
      {isTextArea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={inputStyle}
        />
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  fontSize: "1rem"
};

const btnStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: "8px",
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
  border: "none",
  textAlign: "center"
};
