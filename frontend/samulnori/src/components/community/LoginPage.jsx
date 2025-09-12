import React, { useState } from 'react'
import { useNavigate, Link, useLocation } from "react-router-dom"
import { useAuthStore } from "../../stores/useAuthStore"
import { login } from "../../api/auth"
import { getMyProfile } from "../../api/user"
import { FcGoogle } from "react-icons/fc"
import { RiKakaoTalkFill } from "react-icons/ri";
import { SiNaver } from "react-icons/si"

function LoginPage({ setIsLoggedIn }) {
  const [form, setForm] = useState({ email: "", password: "" })
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || "/"
  
  // localStorage에서 업로드 데이터 확인
  const getUploadData = () => {
    try {
      const data = localStorage.getItem('pendingUploadData');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await login(form)
      const profile = await getMyProfile()
      const filteredUser = {
        id: profile.id,
        nickname: profile.nickname,
        profileImg: profile.profileImg,
        provider: profile.provider,
      }
      useAuthStore.getState().setUser(filteredUser)
      setIsLoggedIn && setIsLoggedIn(true)
      
      // 업로드 데이터가 있으면 업로드 페이지로, 없으면 원래 목적지로 이동
      const uploadData = getUploadData();
      if (uploadData && from === '/upload') {
        // localStorage에서 업로드 데이터 제거
        try {
          localStorage.removeItem('pendingUploadData');
        } catch (e) {}
        
        navigate('/upload', { 
          state: uploadData,
          replace: true 
        })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      alert("로그인 실패: " + (err.response?.data?.message || err.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider) => {
    try {
      await window.electronAPI.oauthLogin(provider)
    } catch (err) {
      alert(`${provider} 로그인 실패: ` + (err.message || err))
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: '#000',
      color: '#fff',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Pretendard', sans-serif",

    }}>
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '380px',
        maxWidth: '95vw',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '14px',
        padding: '40px 32px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <img src='./SAMULNORI_logo.png' alt="logo" style={{ width: '100%', height: 'auto', marginBottom: '25px' }} />

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          <label style={{ fontSize: '0.95rem' }}>
            E-mail
            <input
              type="email"
              name="email"
              placeholder="이메일을 입력해주세요."
              value={form.email}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: '0.95rem' }}>
            P/W
            <input
              type="password"
              name="password"
              placeholder="비밀번호를 입력해주세요."
              value={form.password}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>
          <button type="submit" disabled={isLoading} style={mainButtonStyle}>
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => handleSocialLogin("google")} style={socialButtonStyle("#ffffff", "#000000")}>
            <FcGoogle/> Google로 로그인
          </button>
          <button onClick={() => handleSocialLogin("kakao")} style={socialButtonStyle("#FEE500", "#000000")}>
            <RiKakaoTalkFill/> Kakao로 로그인
          </button>
          <button onClick={() => handleSocialLogin("naver")} style={socialButtonStyle("#03C75A", "#000000")}>
            <SiNaver/> Naver로 로그인
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.95rem', marginBottom: '8px' }}>
          <Link to="/signup" style={{ color: '#CBD5E1', textDecoration: 'underline' }}>아직 회원이 아니신가요?</Link>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          <Link to="/" style={{ color: '#94A3B8', textDecoration: 'underline' }}>홈으로 돌아가기</Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

const inputStyle = {
  width: '100%',
  marginTop: '5px',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid linear-gradient(90deg, #F6E05E, #E53E3E, #EC4899)',
  backgroundColor: '#111',
  color: '#fff',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const mainButtonStyle = {
  padding: '10px',
  borderRadius: '6px',
  background: '#FB7185',
  color: '#000000',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s',
  textAlign: 'center'
}

const socialButtonStyle = (bgColor, textColor) => ({
  padding: '10px',
  borderRadius: '6px',
  backgroundColor: bgColor,
  color: textColor,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.05rem',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
})
