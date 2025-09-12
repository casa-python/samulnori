import React, { useState, useEffect } from 'react';
import MainLayout from './components/MainLayout';
import { WebSocketProvider } from './contexts/WebSocketContext';
import useCameraStore from './stores/cameraStore';
import useObjectSelectionStore from './stores/objectSelectionStore';

import { useAuthStore } from './stores/useAuthStore';
import { useNavigate } from 'react-router-dom';

import { logout } from './api/auth';
import Swal from 'sweetalert2';

import './App.css';

function App() {
  // Header 관련 상태
  const [communityMode, setCommunityMode] = useState(false);

  // 전역 스토어들
  const { reset: resetCameraStore } = useCameraStore();
  const { reset: resetObjectSelectionStore } = useObjectSelectionStore();
  const { clearUser } = useAuthStore();

  // 앱 초기화 시 스토어들 리셋 (한 번만 실행)
  const { user } = useAuthStore();
  const isLoggedIn = !!user;
  // 전역 카메라 스토어
  const { reset } = useCameraStore();
  // 전역 WebSocket 연결 (앱 레벨에서 유지)
  const navigate = useNavigate();

  // 앱 종료 시 쿠키와 스토어 클리어
  useEffect(() => {
    const handleAppExit = async () => {
      console.log('앱 종료: 쿠키 및 스토어 클리어 시작');
      
      try {
        // 로그인 상태라면 로그아웃 API 호출
        if (isLoggedIn) {
          try {
            console.log('로그인 상태 감지: 로그아웃 API 호출');
            await logout();
            console.log('로그아웃 API 호출 완료');
          } catch (error) {
            console.error('로그아웃 API 호출 실패:', error);
          }
        }
        
        // 스토어 클리어
        useAuthStore.getState().clearUser();
        resetCameraStore();
        resetObjectSelectionStore();
        
        // localStorage 추가 정리
        try {
          localStorage.clear();
          sessionStorage.clear();
          console.log('스토리지 클리어 완료');
        } catch (e) {
          console.error('스토리지 클리어 실패:', e);
        }
        
        console.log('앱 종료 정리 완료');
      } catch (error) {
        console.error('앱 종료 정리 중 오류:', error);
      }
    };

    // Electron API에서 앱 종료 이벤트 리스너 등록
    if (window.electronAPI && window.electronAPI.onAppExit) {
      window.electronAPI.onAppExit(handleAppExit);
    }

    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 정리
      if (window.electronAPI && window.electronAPI.onAppExit) {
        // ipcRenderer.removeAllListeners('app-exit'); // 필요시 추가
      }
    };
  }, [isLoggedIn, resetCameraStore, resetObjectSelectionStore]);

  // 앱 초기화 시 스토어들 리셋 (한 번만 실행)
  useEffect(() => {
    resetCameraStore();
    resetObjectSelectionStore();
  // }, []); // 의존성 제거하여 한 번만 실행
  reset();
  if (user) {
    setCommunityMode(true);
  }
  
  // 강제 종료 시 스토어 클리어를 위해 전역으로 노출
  if (typeof window !== 'undefined') {
    window.useAuthStore = useAuthStore;
    window.useCameraStore = useCameraStore;
    window.useObjectSelectionStore = useObjectSelectionStore;
  }
}, [user]); // reset 의존성 제거하여 한 번만 실행

// Header 관련 핸들러
const handleCommunityToggle = () => {
  setCommunityMode(!communityMode);
  navigate('/');
};

// 로그아웃
const handleLogout = async () => {
  await logout();
  if (communityMode) {
    if (navigate) navigate('/');
  } else {
    setCommunityMode(false);
  }
};

// 마이페이지
const handleMypageClick = () => {
  setCommunityMode(true);
  if (navigate) navigate(`/user/${user.id}`);
}
// 로그인 버튼 클릭 시 커뮤니티 모드 진입 및 /login 이동
const handleLoginClick = () => {
  setCommunityMode(true);
  if (navigate) navigate('/login');
};

// 로고 클릭 시 커뮤니티 모드면 커뮤니티 홈으로 이동, 아니면 메인 홈
const handleLogoClick = () => {
  if (communityMode) {
    if (navigate) navigate('/');
  } else {
    setCommunityMode(false);
  }
};

// 업로드 버튼 클릭 시
const handleUploadClick = () => {
  setCommunityMode(true);
  if (navigate) navigate('/upload');
};

const handleRequestUpload = ({ videoFilePath, suggestedName }) => {
  // 로그인 상태 확인
  if (!isLoggedIn) {
    // 로그인하지 않은 경우 업로드 데이터를 localStorage에 저장하고 로그인 페이지로 이동
    if (suggestedName) {
      Swal.fire({
        title: '로그인이 필요합니다.',
        text: '로그인 후 업로드할 수 있습니다.',
        icon: 'warning',
        confirmButtonText: '확인',
      });
    }
    
    try {
      localStorage.setItem('pendingUploadData', JSON.stringify({
        videoFilePath: videoFilePath,
        suggestedName: suggestedName,
      }));
    } catch (e) {
      console.error('업로드 데이터 저장 실패:', e);
    }
    
    setCommunityMode(true);
    if (navigate) navigate('/login', {
      state: {
        from: '/upload'
      },
      replace: false,
    });
    return;
  }
  
  // 로그인된 경우 바로 업로드 페이지로 이동
  setCommunityMode(true);
  if (navigate) navigate('/upload', {
    state: {
      videoFilePath: videoFilePath,
      suggestedName: suggestedName,
    },
    replace: false,
  });
};

return (
  <WebSocketProvider>
    <MainLayout
      communityMode={communityMode}
      isLoggedIn={isLoggedIn}
      onCommunityToggle={handleCommunityToggle}
      onLoginClick={handleLoginClick}
      onLogout={handleLogout}
      onLogoClick={handleLogoClick}
      onMypageClick={handleMypageClick}
      onUploadClick={handleUploadClick}
      onRequestUpload={handleRequestUpload}
    />
  </WebSocketProvider>
);

}
export default App;
