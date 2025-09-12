import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/useAuthStore";
import { searchUsersByNickname } from "../../api/user";
import { getVideoList, searchVideos, getFollowingVideoList } from "../../api/video";
import VideoGrid from "./VideoGrid";
import "../../styles/common/HomePage.css";
import Swal from "sweetalert2";

// SAMULNORI Logo Component with PNG images and CSS animations
const SamulnoriLogo = ({ size = "large" }) => {
  const logoParts = [
    { id: 1, file: 'unblurimageai_1_S.png', delay: 0, margin: '0 2px' },
    { id: 2, file: 'unblurimageai_2_A.png', delay: 0.1, margin: '0 1px' },
    { id: 3, file: 'unblurimageai_3_M.png', delay: 0.2, margin: '0 1px' },
    { id: 4, file: 'unblurimageai_4_U.png', delay: 0.3, margin: '0 1px' },
    { id: 5, file: 'unblurimageai_5_L.png', delay: 0.4, margin: '0 1px' },
    { id: 6, file: 'unblurimageai_6_N.png', delay: 0.5, margin: '0 1px' },
    { id: 7, file: 'unblurimageai_7_O.png', delay: 0.6, margin: '0 1px' },
    { id: 8, file: 'unblurimageai_8_R.png', delay: 0.7, margin: '0 1px' },
    { id: 9, file: 'unblurimageai_9_I.png', delay: 0.8, margin: '0 2px' }
  ];
  
  const getSize = () => {
    if (size === "large") return { width: '5.5rem', height: '5.5rem' };
    if (size === "medium") return { width: '3.8rem', height: '3.8rem' };
    return { width: '2.2rem', height: '2.2rem' };
  };

  return (
    <div 
      className="samulnori-logo" 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        flexWrap: 'nowrap', 
        gap: '0.15rem',
        animation: 'logoContainerFloat 3s ease-in-out infinite',
        maxWidth: size === "large" ? '60rem' : size === "medium" ? '40rem' : '30rem',
        padding: '1rem'
      }}
    >
      {logoParts.map((part, index) => (
        <img
          key={part.id}
          src={`./logo_parts/${part.file}`}
          alt={`SAMULNORI part ${part.id}`}
          className="logo-part"
          style={{
            ...getSize(),
            display: 'inline-block',
            margin: part.margin,
            animation: `logoPartAppear 0.8s ease-out ${part.delay}s both, logoPartFloat ${3 + index * 0.2}s ease-in-out ${part.delay + 0.5}s infinite`,
            cursor: 'default',
            transition: 'all 0.3s ease',
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
            objectFit: 'contain',
            objectPosition: 'center'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.15) rotateY(15deg)';
            e.target.style.filter = 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5)) brightness(1.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1) rotateY(0deg)';
            e.target.style.filter = 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))';
          }}
        />
      ))}
    </div>
  );
};

// Section Component
function Section({ title, accent = '#9F7AEA', rightSlot, children }) {
  return (
    <section
      style={{
        background: ' #000',
        borderRadius: '1rem',
        padding: '1rem',
        // border: '1px solid #374151',
        animation: 'fadeInUp 0.8s ease-out 0.2s both'
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: accent }}>{title}</h2>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}

// EmptyCard Component
function EmptyCard({ title, desc, actionText, onAction }) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #2a2a2a',
      borderRadius: '1rem',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
      <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ color: '#9CA3AF', marginBottom: '1rem' }}>{desc}</div>
      {actionText && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction();
          }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, #F6E05E, #EC4899)',
            color: '#000',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

function HomePage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [followVideos, setFollowVideos] = useState([]);
  const [searchResults, setSearchResults] = useState([]); // 검색 결과를 별도로 저장
  const [searchCategory, setSearchCategory] = useState("user");
  const [currentTab, setCurrentTab] = useState("trending"); // 인기 탭을 기본값으로 변경
  const [sortType, setSortType] = useState("date");
  const [showContent, setShowContent] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(true); // 스크롤 버튼 표시 상태
  const [hasScrolled, setHasScrolled] = useState(false); // 스크롤 버튼이 한 번 클릭되었는지 추적
  const debounceRef = useRef();
  const contentRef = useRef();
  const heroRef = useRef(null); // ✅ 히어로 관찰용

  // ✅ 스크롤 버튼 표시/숨김: 히어로 섹션이 보일 때만 표시
  useEffect(() => {
    if (!heroRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setShowScrollButton(entry.isIntersecting);
      },
      { root: null, threshold: 0.1 }
    );
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, []);

  // 스크롤 위치 감지: 맨 위로 스크롤되면 hasScrolled 리셋
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY === 0 && hasScrolled) {
        setHasScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasScrolled]);

  // Initial hero only (remove phased content)
  useEffect(() => {
    // Show hero immediately; content is visible by default via showContent
  }, []);

  // 전체 비디오 목록 불러오기
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const videoList = await getVideoList();
        setVideos(videoList);
      } catch (err) {
        setVideos([]);
      }
    };
    fetchVideos();
  }, []);

  // 팔로우한 사용자들의 영상 불러오기
  useEffect(() => {
    if (!user) return;
    
    const fetchFollowingVideos = async () => {
      try {
        const followingVideos = await getFollowingVideoList();
        setFollowVideos(followingVideos);
      } catch (err) {
        console.error('팔로우 영상 가져오기 실패:', err);
        setFollowVideos([]);
      }
    };
    fetchFollowingVideos();
  }, [user]);

  // 유저 실시간 검색 (디바운스)
  useEffect(() => {
    if (searchCategory !== "user") return;
    if (!search.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await searchUsersByNickname(search);
        setResults(users);
      } catch (err) {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, searchCategory]);

  // 정렬된 비디오 목록 반환
  const getSortedVideos = () => {
    if (!videos) return [];
    const sorted = [...videos];
    if (sortType === "views") {
      sorted.sort((a, b) => (b.viewCnt || 0) - (a.viewCnt || 0));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return sorted;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    setLoading(true);
    try {
      if (searchCategory === "user") {
        const users = await searchUsersByNickname(search);
        setResults(users);
      } else if (searchCategory === "video") {
        const videos = await searchVideos(search);
        setResults([]);
        // 검색 결과를 별도로 저장 (전체 비디오 목록은 유지)
        setSearchResults(videos);
      }
    } catch (err) {
      alert("검색 실패");
      setResults([]);
      if (searchCategory === "video") setSearchResults([]);
    }
    setLoading(false);
  };

  const scrollToContent = () => {
    
    if (!contentRef.current) {
      console.log('contentRef가 없음');
      return;
    }
    
    // 컨텐츠 섹션으로 직접 스크롤
    try {
      // scrollIntoView 사용 (더 안정적)
      contentRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    } catch (error) {
      console.error('scrollIntoView 오류:', error);
      
      // fallback: window.scrollTo 사용
      const contentTop = contentRef.current.offsetTop;
      const stickyHeight = 80;
      const scrollTop = contentTop - stickyHeight;
      
      console.log('fallback scrollTop:', scrollTop);
      window.scrollTo({ 
        top: scrollTop, 
        behavior: 'smooth' 
      });
    }
    
    // 스크롤 버튼 숨김 및 스크롤 완료 표시
    setShowScrollButton(false);
    setHasScrolled(true);
  };

  const handleUploadClick = () => {
    if (!user) {
      Swal.fire({
        title: '로그인이 필요합니다',
        text: '영상 업로드를 하려면 로그인이 필요합니다.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '로그인',
        cancelButtonText: '취소',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
    } else {
      navigate('/upload');
    }
  };

  return (
    <div className="community-home" style={{ minHeight: '100vh', background: '#000000', color: 'white', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Hero Section */}
      <div
        ref={heroRef} // ✅ 관찰 대상
        style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div
          className="intro-section"
          style={{ 
            textAlign: 'center',
            animation: 'fadeInScale 1s ease-out forwards'
          }}
        >
          <h1
            style={{ 
              fontSize: '3rem',
              fontWeight: 'bold',
              marginBottom: '2rem',
              background: 'linear-gradient(90deg, #F6E05E, #E53E3E, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradientShift 3s ease-in-out infinite'
            }}
          >
            세상의 모든 것을 악기로.
          </h1>
          
          <SamulnoriLogo size="large" />
          
          <div
            style={{ 
              fontSize: '4rem', 
              marginTop: '2rem',
              animation: 'drumSpin 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 2s both',
              position: 'relative'
            }}
          >
            🥁
          </div>
        </div>
      </div>

      {/* 스크롤 안내 애니메이션 - 화면 바닥 */}
      {showScrollButton && !hasScrolled && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'scrollHint 2s ease-in-out infinite',
            padding: '1rem',
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            width: '100%',
            zIndex: 9999, // 매우 높은 z-index로 설정
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            pointerEvents: 'auto',
            cursor: 'pointer', // 전체 영역에 커서 포인터 추가
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollToContent();
          }}
        >
          <div style={{ 
            fontSize: '0.9rem', 
            fontWeight: 600, 
            color: '#9CA3AF',
            textAlign: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          >
            영상 보기
          </div>
          <div
            style={{ 
              fontSize: '1.5rem',
              cursor: 'pointer',
              animation: 'bounceArrow 1.5s ease-in-out infinite',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}
            aria-label="영상 섹션으로 이동"
          >
            ↓
          </div>
        </div>
      )}

      {/* Content Section */}
      {showContent && (
        <div 
          ref={contentRef} 
          className="content-section"
          style={{ 
            position: 'relative', 
            zIndex: 10, 
            animation: 'slideInUp 1s ease-out forwards',
            scrollMarginTop: '80px', // ✅ sticky 헤더 높이에 맞게
          }}
        >
          <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '3rem 1rem' }}>
            
            {/* 검색바 - 상단 고정 */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                margin: '-1rem -1rem 1.25rem -1rem',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid #374151',
              }}
            >
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <select
                  value={searchCategory}
                  onChange={e => {
                    const newCategory = e.target.value;
                    setSearchCategory(newCategory);
                    setResults([]);
                    setSearchResults([]);
                    setSearch("");
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#374151',
                    borderRadius: '0.5rem',
                    border: '1px solid #4B5563',
                    color: 'white',
                    minWidth: 100
                  }}
                >
                  <option value="user">유저</option>
                  <option value="video">영상</option>
                </select>
                
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    const newSearch = e.target.value;
                    setSearch(newSearch);
                    
                    // 검색어가 지워지면 검색 결과 초기화
                    if (!newSearch.trim()) {
                      setResults([]);
                      setSearchResults([]);
                    }
                  }}
                  placeholder={searchCategory === "user" ? "닉네임으로 유저 검색" : "키워드로 영상 검색"}
                  style={{
                    width: '36rem',
                    maxWidth: '80vw',
                    padding: '0.75rem 1rem',
                    background: '#374151',
                    borderRadius: '0.5rem',
                    border: '1px solid #4B5563',
                    color: 'white',
                    flex: '1 1 auto'
                  }}
                />

                <button
                  type="submit"
                  className="animated-button"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(90deg, #9F7AEA, #EC4899)',
                    borderRadius: '0.5rem',
                    fontWeight: '700',
                    border: '1px solid #9F7AEA',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 0 20px #9F7AEA55';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  검색
                </button>

                  <button
                    type="button"
                    onClick={() => handleUploadClick()}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#10B981',
                      borderRadius: '0.5rem',
                      border: '1px solid #059669',
                      color: '#00110D',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ⬆ 업로드
                  </button>
              </form>

              {loading && search.trim() && (
                <div style={{ textAlign: 'center', marginTop: '0.75rem', color: '#9CA3AF' }}>
                  검색 중...
                </div>
              )}
            </div>

            {/* 탭 - 검색 결과가 있을 때는 숨김 */}
            {!search.trim() && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                {[
                  { key: 'trending', label: '인기' },
                  { key: 'follow', label: '팔로잉' },
                  { key: 'all', label: '전체' },
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentTab(t.key);
                    }}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '9999px',
                      border: '1px solid #4B5563',
                      background: currentTab === t.key
                        ? 'linear-gradient(90deg, #F6E05E, #EC4899)'
                        : '#374151',
                      color: currentTab === t.key ? '#000' : '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* 검색 결과: 유저 */}
            {searchCategory === "user" && results.length > 0 && (
              <div style={{ marginTop: '0.5rem', animation: 'fadeInUp 0.5s ease-out forwards' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: '#9F7AEA' }}>유저 검색 결과</h3>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.75rem',
                  maxWidth: '600px',
                  margin: '0 auto'
                }}>
                  {results.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => navigate(`/user/${u.id}`)}
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        cursor: 'pointer',
                        padding: '1rem',
                        borderRadius: '1rem',
                        transition: 'all 0.25s',
                        background: '#111',
                        border: '1px solid #2a2a2a',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.transform = 'translateY(-2px)'; 
                        e.currentTarget.style.backgroundColor = '#171717';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.transform = 'translateY(0)'; 
                        e.currentTarget.style.backgroundColor = '#111';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }}
                    >
                      {u.profileImg ? (
                        <img 
                          src={u.profileImg}
                          alt="프로필"
                          style={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: '2px solid #374151'
                          }}
                        />
                      ) : (
                        <div style={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '18px',
                          fontWeight: '600',
                          color: 'white'
                        }}>
                          {u.nickname?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: 700, 
                          fontSize: '1.1rem',
                          marginBottom: '4px'
                        }}>
                          {search ? u.nickname.split(new RegExp(`(${search})`, 'gi')).map((part, i) => (
                            <span key={i} style={{ 
                              color: part.toLowerCase() === search.toLowerCase() ? '#F6E05E' : '#fff',
                              textShadow: part.toLowerCase() === search.toLowerCase() ? '0 0 8px rgba(246, 224, 94, 0.3)' : 'none'
                            }}>
                              {part}
                            </span>
                          )) : u.nickname}
                        </div>
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: '#9CA3AF',
                          fontWeight: 500
                        }}>
                          팔로워 {u.followerCnt} 명
                        </div>
                      </div>
                      <div style={{ 
                        color: '#9CA3AF',
                        fontSize: '1.2rem',
                        opacity: 0.7
                      }}>
                        →
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 검색 결과: 영상 */}
            {searchCategory === "video" && search.trim() && (
              <div style={{ marginTop: '0.5rem', animation: 'fadeInUp 0.5s ease-out forwards' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: ' #9F7AEA' }}>영상 검색 결과</h3>
                <VideoGrid 
                  videos={searchResults} 
                  emptyText="검색 결과가 없습니다." 
                />
              </div>
            )}

            {/* 로딩 스켈레톤 (검색/목록 공용) */}
            {loading && (
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ background: '#111', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid #2a2a2a' }}>
                    <div style={{ width: '100%', paddingTop: '56%', background: '#1F2937', borderRadius: '0.5rem', marginBottom: '0.5rem', animation: 'fadeIn 1.2s ease-in-out infinite alternate' }} />
                    <div style={{ height: '10px', background: '#1F2937', borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ width: '60%', height: '10px', background: '#1F2937', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            )}

            {/* 탭 컨텐츠 - 검색 중이 아닐 때만 표시 */}
            {!loading && !search.trim() && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                {/* 탭에 따른 컨텐츠 스위치 */}
                {(() => {
                  // 탭: 인기 (기본) - 이번달 조회수 top 10
                  if (currentTab === 'trending') {
                    const now = new Date();
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    
                    // 이번달에 업로드된 영상들만 필터링하고 조회수 순으로 정렬
                    const trending = [...videos]
                      .filter(video => new Date(video.createdAt) >= startOfMonth)
                      .sort((a, b) => (b.viewCnt || 0) - (a.viewCnt || 0))
                      .slice(0, 10); // top 10만 선택
                    
                    return (
                      <Section title="이번달 인기 TOP 10" accent="#F6E05E">
                        <VideoGrid 
                          videos={trending} 
                          emptyText="이번달 인기 영상이 없습니다." 
                        />
                      </Section>
                    );
                  }

                  // 탭: 팔로잉
                  if (currentTab === 'follow') {
                    if (!user) {
                      return (
                        <EmptyCard
                          title="로그인이 필요합니다"
                          desc="팔로우한 크리에이터의 최신 영상을 보려면 로그인하세요."
                          actionText="로그인"
                          onAction={() => navigate('/login')}
                        />
                      );
                    }
                    if (!followVideos || followVideos.length === 0) {
                      return (
                        <EmptyCard
                          title="팔로우한 유저의 영상이 없습니다"
                          desc="관심 있는 크리에이터를 팔로우하고 새 영상을 받아보세요."
                          actionText="유저 찾기"
                          onAction={() => {
                            setCurrentTab('all');
                            setSearchCategory('user');
                          }}
                        />
                      );
                    }
                    return (
                      <Section title="팔로잉 최신" accent="#EC4899">
                        <VideoGrid videos={[...followVideos].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))} emptyText="영상이 없습니다." />
                      </Section>
                    );
                  }

                  // 탭: 전체 (업로드 순으로 정렬)
                  if (currentTab === 'all') {
                    return (
                      <Section
                        title="전체 영상"
                        accent="#3182CE"
                        rightSlot={
                          <div style={{ fontSize: '0.9rem', color: '#A3A3A3' }}>
                            최신순
                          </div>
                        }
                      >
                        <VideoGrid
                          videos={getSortedVideos()}
                          emptyText="전체 영상이 없습니다."
                        />
                      </Section>
                    );
                  }
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes logoPartAppear {
          from {
            opacity: 0;
            transform: translateY(50px) rotateY(-90deg) scale(0.5);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotateY(0deg) scale(1);
          }
        }

        @keyframes logoPartFloat {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          25% { 
            transform: translateY(-8px) rotate(2deg); 
          }
          50% { 
            transform: translateY(-12px) rotate(0deg); 
          }
          75% { 
            transform: translateY(-8px) rotate(-2deg); 
          }
        }

        @keyframes logoContainerFloat {
          0%, 100% { 
            transform: translateY(0px); 
          }
          50% { 
            transform: translateY(-5px); 
          }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeOutScale {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(1.2);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(100px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes drumSpin {
          from {
            transform: scale(0) rotate(-180deg);
          }
          to {
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
          }
          40%, 43% {
            transform: translate3d(0,-30px,0);
          }
          70% {
            transform: translate3d(0,-15px,0);
          }
          90% {
            transform: translate3d(0,-4px,0);
          }
        }

        @keyframes scrollHint {
          0%, 100% {
            opacity: 0.7;
            transform: translateX(-50%) translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) translateY(-10px);
          }
        }

        @keyframes bounceArrow {
          0%, 20%, 53%, 80%, 100% {
            transform: translateY(0);
          }
          40%, 43% {
            transform: translateY(-8px);
          }
          70% {
            transform: translateY(-4px);
          }
          90% {
            transform: translateY(-2px);
          }
        }

        @keyframes uploadButtonPulse {
          0%, 100% {
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.6);
          }
        }

        .animated-button {
          transform: scale(1);
        }
        
        .animated-button:active {
          transform: scale(0.95) !important;
        }
      `}</style>
    </div>
  );
}

export default HomePage;
