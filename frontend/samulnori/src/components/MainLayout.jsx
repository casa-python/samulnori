import React, { useState } from 'react';
import HeaderComponent from './HeaderComponent';
import { CameraComponent } from './camera';
import SettingRouter from '../routers/setting/SettingRouter';
import CommunityComponent from './CommunityComponent';
import LoopIslandComponent from './LoopIslandComponent';
import BackendLoadingOverlay from './common/BackendLoadingOverlay';
import SoundWaveBackground from './common/SoundWaveBackground';
import { useWebSocket } from '../contexts/WebSocketContext';
import useCameraStore from '../stores/cameraStore';

function MainLayout({ 
  communityMode, 
  isLoggedIn, 
  onCommunityToggle, 
  onLoginClick, 
  onLogout, 
  onLogoClick,
  onMypageClick,
  onUploadClick,
  onRequestUpload,
}) {
  const [settingOpen, setSettingOpen] = useState(true);
  const [currentSettingView, setCurrentSettingView] = useState('initial');
  const [selectedObjectForMapping, setSelectedObjectForMapping] = useState(null);
  
  // 전역 스토어에서 필요한 상태들 가져오기
  const { streamReady, selectedObjects, toggleSelectedObject } = useCameraStore();
  
  // WebSocket 연결 상태로 백엔드 준비 여부 판단
  const { connected, error, retryCount, reconnect } = useWebSocket();

  // 카메라에서 선택된 사물 변경 시 호출되는 핸들러
  const handleSelectedObjectChange = (selectedObject) => {
    setSelectedObjectForMapping(selectedObject);
  };

  // WebSocket이 연결되지 않았으면 로딩 오버레이 표시
  if (!connected) {
    return (
      <BackendLoadingOverlay 
        isLoading={!error}
        error={error}
        connectionAttempts={retryCount}
        retryConnection={reconnect}
      />
    );
  }

  return (
    <div className={communityMode ? 'main-layout community-bg' : 'main-layout'}>
      {/* 커뮤니티 모드일 때만 SoundWaveBackground 렌더링 */}
      {communityMode && <SoundWaveBackground />}
      
      <HeaderComponent 
        communityMode={communityMode}
        isLoggedIn={isLoggedIn}
        onCommunityToggle={onCommunityToggle}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        onMypageClick={onMypageClick}
        onUploadClick={onUploadClick}
      />
      {communityMode ? (
        <CommunityComponent />
      ) : (
        <div className="main-content-row">
          <CameraComponent 
            settingOpen={settingOpen} 
            onOpen={() => setSettingOpen(true)}
            currentSettingView={currentSettingView}
            onSelectedObjectChange={handleSelectedObjectChange}
            selectedObjectForMapping={selectedObjectForMapping}
            onRequestUpload={onRequestUpload}
            loopIslandComponent={<LoopIslandComponent />}
          />
          {settingOpen && (
            <SettingRouter
              open={settingOpen}
              onClose={() => setSettingOpen(false)}
              streamReady={streamReady}
              selectedObjects={selectedObjects}
              onObjectToggle={toggleSelectedObject}
              onViewChange={setCurrentSettingView}
              selectedObjectForMapping={selectedObjectForMapping}
              setSelectedObjectForMapping={setSelectedObjectForMapping}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default MainLayout; 