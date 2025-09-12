import React, { useState } from "react"
import { signup } from "../../api/auth"
import { useNavigate, Link } from "react-router-dom"
import Swal from "sweetalert2";

function SignupPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nickname: "",
  })
  const [profileImg, setProfileImg] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setProfileImg(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPreviewUrl(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await signup({ ...formData, profileImg })
      Swal.fire({
        title: "회원가입이 완료되었습니다!",
        icon: "success",
      }).then(() => {
        navigate("/login")
      })
    } catch (error) {
      console.error("회원가입 실패:", error)
      Swal.fire({
        title: "회원가입에 실패했습니다.",
        icon: "error",
      })
    }
  }

  // 컴포넌트 언마운트 시 프리뷰 URL 정리
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl, profileImg])

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
        width: '400px',
        maxWidth: '95vw',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '14px',
        padding: '40px 32px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          fontSize: '2.1rem',
          fontWeight: 800,
          textAlign: 'center',
          marginBottom: '25px',
          background: 'linear-gradient(90deg, #F6E05E, #E53E3E, #EC4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          회원가입
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={labelStyle}>
            이메일
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            비밀번호
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            닉네임
            <input
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            프로필 이미지
            <input
              type="file"
              name="profileImg"
              accept="image/*"
              onChange={handleFileChange}
              style={{
                ...inputStyle,
                padding: '8px 10px',
                backgroundColor: '#1F2937',
                color: '#fff',
                border: '1px solid #4FD1C7'
              }}
            />
          </label>
          
          {/* 이미지 프리뷰 */}
          {previewUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              marginTop: '8px'
            }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#94A3B8',
                marginBottom: '4px'
              }}>
                선택된 이미지
              </div>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid #4FD1C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1F2937'
              }}>
                <img
                  src={previewUrl}
                  alt="프로필 프리뷰"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                  onLoad={() => console.log('이미지 로드 성공:', previewUrl)}
                  onError={(e) => {
                    console.error('이미지 로드 실패:', e.target.src)
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div style={{
                  display: 'none',
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  color: '#94A3B8',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}>
                  이미지<br />로드 실패
                </div>
              </div>
            </div>
          )}
          
          <button type="submit" style={submitButtonStyle}>
            회원가입
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.95rem', color: '#CBD5E1' }}>
          이미 계정이 있으신가요?{" "}
          <Link to="/login" style={{ color: '#94A3B8', textDecoration: 'underline' }}>로그인</Link>
        </div>
      </div>
    </div>
  )
}

export default SignupPage

const labelStyle = {
  fontSize: '0.95rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid linear-gradient(90deg, #F6E05E, #E53E3E, #EC4899)',
  backgroundColor: '#111',
  color: '#fff',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const submitButtonStyle = {
  marginTop: '10px',
  background: '#FBBF24',
  color: '#fff',
  border: 'none',
  borderRadius: '7px',
  padding: '12px 0',
  fontSize: '1.1rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: '0.3s',
  textAlign: 'center',
}
