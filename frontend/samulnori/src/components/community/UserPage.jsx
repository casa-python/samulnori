import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getUserProfile } from "../../api/user"
import { followUser, unfollowUser, getFollowings, getFollowers } from "../../api/follow"
import VideoGrid from "./VideoGrid"
import UserCard from "./UserCard"
import { useAuthStore } from "../../stores/useAuthStore"
import Swal from "sweetalert2"

function UserPage() {
  const { id } = useParams()
  const loginUser = useAuthStore(state => state.user)
  const [user, setUser] = useState(null)
  const [videos, setVideos] = useState([])
  const [introduce, setIntroduce] = useState("")
  const [isFollowing, setIsFollowing] = useState(false)
  const [followingList, setFollowingList] = useState([])
  const [followersList, setFollowersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("videos")
  const navigate = useNavigate()

  const handleTabClick = (tab) => {
    // 로그인하지 않은 상태에서 팔로잉/팔로워 탭 클릭 시
    if (!loginUser && (tab === "following" || tab === "followers")) {
      Swal.fire({
        title: '로그인이 필요합니다',
        text: '팔로잉/팔로워 목록을 보려면 로그인이 필요합니다.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '로그인',
        cancelButtonText: '취소',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login')
        }
      })
      return
    }
    setActiveTab(tab)
  }

  const fetchUserData = async () => {
    try {
      const userData = await getUserProfile(id)
      setUser(userData.userDTO)
      setVideos(userData.videos)
      setIntroduce(userData.introduce)

      // 로그인한 사용자만 팔로잉/팔로워 정보 가져오기
      if (loginUser && loginUser.id) {
        try {

          const [followings, followers] = await Promise.all([
            getFollowings(userData.userDTO.id),
            getFollowers(userData.userDTO.id),
          ])

          const myFollowings = await getFollowings(loginUser.id)
          const loginUserFollowingIds = myFollowings.map((user) => user.id)

          if (loginUser.id !== userData.userDTO.id) {
            const isFollowingTarget = loginUserFollowingIds.includes(userData.userDTO.id)
            setIsFollowing(isFollowingTarget)
          }

          // 팔로잉/팔로워 각각 isFollowed 속성 추가
          const withIsFollowed = (list) =>
            list.map((u) => ({
              ...u,
              isFollowing: loginUserFollowingIds.includes(u.id),
            }))

          setFollowingList(withIsFollowed(followings))
          setFollowersList(withIsFollowed(followers))
        } catch (followError) {
          console.error('팔로잉/팔로워 정보 가져오기 실패:', followError)
          // 팔로잉/팔로워 정보 가져오기 실패 시에도 기본 정보는 표시
          setFollowingList([])
          setFollowersList([])
          setIsFollowing(false)
        }
      } else {
        // 로그인하지 않은 경우에는 기본값 설정
        setIsFollowing(false)
        setFollowingList([])
        setFollowersList([])
      }

    } catch (err) {
      console.error('사용자 정보 가져오기 실패:', err)
      // 에러 발생 시에도 로딩 상태 해제
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserData()
  }, [id])

  if (loading) return <div>로딩 중...</div>
  if (!user) return <div>사용자를 찾을 수 없습니다.</div>

  const isMine = loginUser?.id && user?.id && loginUser.id === user.id

  const toggleFollow = async (targetUserId) => {
    // 로그인하지 않은 경우 로그인 페이지로 이동
    if (!loginUser || !loginUser.id) {
      Swal.fire({
        title: '로그인이 필요합니다.',
        text: '로그인 페이지로 이동합니다.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '확인',
        cancelButtonText: '취소',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login')
        }
      })
      return
    }

    try {
      const isProfileOwner = targetUserId === user.id

      if (isProfileOwner) {
        if (isFollowing) {
          await unfollowUser(targetUserId)
          setIsFollowing(false)
        } else {
          await followUser(targetUserId)
          setIsFollowing(true)
        }
      } else {
        const listToUpdate = activeTab === "following" ? followingList : followersList
        const isFollowed = listToUpdate.find(u => u.id === targetUserId)?.isFollowing

        if (isFollowed) {
          await unfollowUser(targetUserId)
        } else {
          await followUser(targetUserId)
        }

        const updateList = (setter, list) => {
          setter(list.map(u =>
            u.id === targetUserId ? { ...u, isFollowing: !u.isFollowing } : u
          ))
        }

        if (activeTab === "following") {
          updateList(setFollowingList, followingList)
        } else {
          updateList(setFollowersList, followersList)
        }
      }

      await fetchUserData()
    } catch (error) {
      alert("팔로우 변경 실패")
      console.error(error)
    }
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#000', color: '#fff', position: 'relative', overflowX: 'hidden', paddingTop: '5rem' }}>

      {/* 전체 콘텐츠 래퍼 */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          {/* 좌측: 프로필 정보 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '108px', // 100px + 2 * 4px padding
                height: '108px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F6E05E, #E53E3E, #EC4899)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={user.profileImg || "https://via.placeholder.com/100x100?text=👤"}
                alt="프로필"
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  background: '#000',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{user.nickname}</div>
              <div style={{ fontSize: '0.95rem', color: '#ccc', marginTop: '6px' }}>
                {introduce}
              </div>
            </div>
          </div>

          {/* 우측: 버튼 */}
          <div>
            {isMine ? (
              <button style={editButtonStyle} onClick={() => navigate(`/profile/edit`)}>프로필 편집</button>
            ) : (
              <button style={isFollowing ? unfollowButtonStyle : followButtonStyle} onClick={() => toggleFollow(user.id)}>{isFollowing ? "언팔로우" : "팔로우"}</button>
            )}
          </div>
        </div>

        {/* ✅ 탭 메뉴 */}
        <div style={{
          display: 'flex',
          gap: '30px',
          borderBottom: '1px solid #333',
          paddingBottom: '12px',
          marginBottom: '20px',
        }}>
          {["videos", "following", "followers"].map(tab => (
            <div
              key={tab}
              onClick={() => handleTabClick(tab)}
              style={{
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? '#FB7185' : '#ccc',
                borderBottom: activeTab === tab ? '2px solid #FB7185' : 'none',
                paddingBottom: '4px',
                opacity: !loginUser && (tab === "following" || tab === "followers") ? 0.6 : 1,
              }}
            >
              {tab === "videos" ? `업로드(${videos.length})` : tab === "following" ? `팔로잉${loginUser ? `(${followingList.length})` : `(${user.followerCnt})`}` : `팔로워${loginUser ? `(${followersList.length})` : ''}`}
            </div>
          ))}
        </div>

        {/* ✅ 탭 내용 */}
        {activeTab === "videos" && (
          <VideoGrid videos={videos} emptyText="업로드한 영상이 없습니다." />
        )}

        {activeTab === "following" && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            justifyContent: 'center',
          }}>
            {!loginUser ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#aaa',
                maxWidth: '400px',
                margin: '0 auto'
              }}>
                <div style={{
                  fontSize: '1.2rem',
                  marginBottom: '12px',
                  color: '#fff'
                }}>
                  로그인이 필요합니다
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  marginBottom: '20px',
                  lineHeight: '1.5'
                }}>
                  팔로잉 목록을 보려면 로그인해주세요.
                </div>
                <button
                  onClick={() => handleTabClick(activeTab)}
                  style={{
                    background: '#2C6FAA',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  로그인하기
                </button>
              </div>
            ) : followingList.length === 0 ? (
              <div style={{ color: '#aaa' }}>팔로잉한 유저가 없습니다.</div>
            ) : (
              followingList.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  onClick={() => toggleFollow(user.id)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "followers" && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            justifyContent: 'center',
          }}>
            {!loginUser ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#aaa',
                maxWidth: '400px',
                margin: '0 auto'
              }}>
                <div style={{
                  fontSize: '1.2rem',
                  marginBottom: '12px',
                  color: '#fff'
                }}>
                  로그인이 필요합니다
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  marginBottom: '20px',
                  lineHeight: '1.5'
                }}>
                  팔로워 목록을 보려면 로그인해주세요.
                </div>
                <button
                  onClick={() => handleTabClick(activeTab)}
                  style={{
                    background: '#2C6FAA',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  로그인하기
                </button>
              </div>
            ) : followersList.length === 0 ? (
              <div style={{ color: '#aaa' }}>팔로우한 유저가 없습니다.</div>
            ) : (
              followersList.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  onClick={() => toggleFollow(user.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserPage

const followButtonStyle = {
  background: ' #2C6FAA',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 14px',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9rem',
}

const unfollowButtonStyle = {
  background: ' #F43F5E',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 14px',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9rem',
}

const editButtonStyle = {
  background: ' #A78BFA',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 14px',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9rem',
}