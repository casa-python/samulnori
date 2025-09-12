import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import '../styles/layout/HeaderComponent.css';

function HeaderComponent({
  communityMode,
  isLoggedIn,
  onCommunityToggle,
  onLoginClick,
  onLogout,
  onLogoClick,
  onMypageClick,
  onUploadClick,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const user = useAuthStore((state) => state.user);
  const isWhiteHeader = communityMode;

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    setShowDropdown(false);
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div
        className="logo"
        onClick={onLogoClick}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {!isWhiteHeader? (
          <img src="./SAMULNORI_logo.png" alt="SAMULNORI" style={{ height: '28px', filter: 'brightness(0) invert(1)' }} />
        ):(
          <img src="./SAMULNORI_logo.png" alt="SAMULNORI" style={{ height: '28px' }} />
        )}
      </div>
      <div className="header-right">
        <span className="community-label">커뮤니티</span>
        <label className="toggle-switch">
          <input type="checkbox" checked={communityMode} onChange={onCommunityToggle} />
          <span className="slider"></span>
        </label>

        {isLoggedIn ? (
          <div className="profile-wrapper" ref={dropdownRef}>
            <img
              src={user?.profileImg}
              alt="Profile"
              className="profile-button"
              onClick={() => setShowDropdown((prev) => !prev)}
            />
            {showDropdown && (
              <div className="dropdown-menu">
                <div onClick={onMypageClick}>MYPAGE</div>
                <div onClick={onLogout}>LOGOUT</div>
                <div onClick={onUploadClick}>UPLOAD</div>
              </div>
            )}
          </div>
        ) : (
          <span className="login-menu" onClick={onLoginClick}>
            LOGIN
          </span>
        )}
      </div>
    </header>
  );
}

export default HeaderComponent;
