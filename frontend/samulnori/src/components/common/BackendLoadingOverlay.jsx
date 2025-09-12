import React from 'react';
import '../../styles/common/BackendLoadingOverlay.css';

const BackendLoadingOverlay = ({ isLoading, error, connectionAttempts, retryConnection }) => {
  if (!isLoading && !error) {
    return null; // 백엔드가 준비되면 오버레이 숨김
  }

  return (
    <div className="backend-loading-overlay">
      <div className="logo-stack" aria-label="SAMULNORI 로고 애니메이션">
        <div className="logo-row">
          <img className="logo-part part-s" src="./logo_parts/unblurimageai_1_S.png" alt="S" />
          <img className="logo-part part-a" src="./logo_parts/unblurimageai_2_A.png" alt="A" />
          <img className="logo-part part-m" src="./logo_parts/unblurimageai_3_M.png" alt="M" />
          <img className="logo-part part-u" src="./logo_parts/unblurimageai_4_U.png" alt="U" />
          <img className="logo-part part-l" src="./logo_parts/unblurimageai_5_L.png" alt="L" />
          <img className="logo-part part-n" src="./logo_parts/unblurimageai_6_N.png" alt="N" />
          <img className="logo-part part-o" src="./logo_parts/unblurimageai_7_O.png" alt="O" />
          <img className="logo-part part-r" src="./logo_parts/unblurimageai_8_R.png" alt="R" />
          <img className="logo-part part-i" src="./logo_parts/unblurimageai_9_I.png" alt="I" />
        </div>
      </div>
      <div className='loading-content'>
        <p className='loading-title'>로딩 중입니다...</p>
        <div className='loading-spinner' />
      </div>
    </div>
  );
};

export default BackendLoadingOverlay; 