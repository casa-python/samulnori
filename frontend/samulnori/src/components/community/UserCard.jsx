import React from "react"
import { useNavigate } from "react-router-dom"

function UserCard({ user, onClick }) {
  const navigate = useNavigate()
  const buttonLabel = user.isFollowing ? "언팔로우" : "팔로우"
  const buttonStyle = user.isFollowing
    ? {
        background: " #F43F5E",
        color: "#fff",
      }
    : {
        background: " #2C6FAA",
        color: "#000",
      }

  const handleCardClick = (e) => {
    // 버튼 클릭 시에는 카드 클릭 방지
    if (e.target.closest(".follow-btn")) return
    navigate(`/user/${user.id}`)
  }

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: "#111",
        borderRadius: "12px",
        padding: "20px",
        width: "180px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.3s ease",
        transform: "scale(1)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {/* 프로필 이미지 */}
      <div
        style={{
          width: "84px",
          height: "84px",
          borderRadius: "50%",
          background: "#000",
          padding: "2px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={user.profileImg || "https://via.placeholder.com/80x80?text=👤"}
          alt={`${user.nickname}의 프로필`}
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            objectFit: "cover",
            background: "#000",
          }}
        />
      </div>

      {/* 닉네임 */}
      <div
        style={{
          fontWeight: 600,
          fontSize: "1rem",
          marginBottom: "12px",
          wordBreak: "break-word",
        }}
      >
        {user.nickname}
      </div>

      {/* 팔로우 버튼 (클릭 이벤트 방지 위해 class 추가) */}
      <div
        className="follow-btn"
        onClick={(e) => {
          e.stopPropagation() // 카드 클릭 막기
          onClick()
        }}
        style={{
          ...buttonStyle,
          borderRadius: "6px",
          padding: "8px 16px",
          fontWeight: 600,
          fontSize: "0.9rem",
          cursor: "pointer",
          transition: "all 0.2s",
          textAlign: "center",
          display: "inline-block",
        }}
      >
        {buttonLabel}
      </div>
    </div>
  )
}

export default UserCard
