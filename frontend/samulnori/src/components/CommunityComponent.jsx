import React from 'react'
import '../styles/common/CommunityComponent.css'
import CommunityRouter from "../routers/community/index.jsx";

function CommunityComponent() {
  return (
    <div className="community-page">
      <CommunityRouter />
    </div>
  )
}

export default CommunityComponent 