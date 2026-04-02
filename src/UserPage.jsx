import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './index.css'; 

/* --- 🔍 텍스트 하이라이트 컴포넌트 --- */
function HighlightText({ text, highlight }) {
  if (!highlight.trim()) return <span>{text}</span>;
  
  // 정규식 특수문자 에러 방지
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapeRegExp(highlight)})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} style={{ backgroundColor: '#ffeb3b', color: '#000', fontWeight: 'bold', padding: '0 2px', borderRadius: '3px' }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function UserPage() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 🔍 검색 상태 관리
  const [searchQuery, setSearchQuery] = useState('');

  // 테마 초기화
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark');
    }
  }, []);

  // 테마 전환 토글
  const toggleTheme = () => {
    if (isDarkMode) {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // 파이어베이스 데이터 불러오기 (order 정렬)
  useEffect(() => {
    const q = query(collection(db, 'tabs'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTabs(tabData);
      if (tabData.length > 0 && activeTab === '') {
        setActiveTab(tabData[0].id);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab]);

  // 🔍 검색 결과 필터링
  const searchResults = tabs.flatMap(tab => 
    (tab.links || [])
      .map((link, index) => ({ tab, link, index }))
      .filter(({ link }) => 
        link.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        link.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  if (loading) return <div className="container">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="container">
      <h2 className="title">업무 링크 모음</h2>

      {/* 🔍 링크 통합 검색창 */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="🔍 찾고 싶은 링크 제목이나 주소를 검색하세요..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          style={{ 
            width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', 
            border: '2px solid var(--tab-active)', boxSizing: 'border-box',
            backgroundColor: 'var(--card-bg)', color: 'var(--text-color)' 
          }} 
        />
      </div>
      
      {/* 🔍 검색어가 있을 때: 검색 결과 화면 렌더링 */}
      {searchQuery.trim() !== '' ? (
        <div style={{ background: 'var(--hover-bg)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0 }}>🔎 검색 결과 ({searchResults.length}건)</h3>
          {searchResults.length === 0 ? (
            <p style={{ color: 'var(--tab-inactive)' }}>일치하는 링크가 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {searchResults.map((res, i) => (
                <li key={i} style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', marginBottom: '10px', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', transition: 'background-color 0.2s' }}>
                  
                  {/* 검색 결과 텍스트 (클릭 시 새 창으로 링크 열림) */}
                  <a href={res.link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-color)', flex: 1, wordBreak: 'break-all' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--hover-bg)', color: 'var(--tab-active)', fontSize: '12px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                      📂 {res.tab.name}
                    </span><br/>
                    <strong style={{ fontSize: '16px' }}>
                      <HighlightText text={res.link.title} highlight={searchQuery} />
                    </strong><br/>
                    <span style={{ color: 'var(--tab-inactive)', fontSize: '13px' }}>
                      <HighlightText text={res.link.url} highlight={searchQuery} />
                    </span>
                  </a>

                  {/* 탭으로 이동 버튼 */}
                  <button 
                    onClick={() => {
                      setActiveTab(res.tab.id); // 해당 탭으로 이동
                      setSearchQuery(''); // 검색창 초기화하여 원래 화면으로 복귀
                    }}
                    style={{ background: 'var(--tab-inactive)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    이 탭으로 이동 ➡️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* 검색어가 없을 때: 기존 탭 & 링크 화면 렌더링 */
        <>
          {tabs.length === 0 ? (
            <p>등록된 탭이 없습니다. 어드민 페이지에서 탭을 추가해주세요.</p>
          ) : (
            <>
              <div className="tab-wrapper">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '10px 20px',
                      cursor: 'pointer',
                      fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                      color: activeTab === tab.id ? 'var(--tab-active)' : 'var(--tab-inactive)',
                      borderBottom: activeTab === tab.id ? '3px solid var(--tab-active)' : '3px solid transparent',
                      marginBottom: '-2px'
                    }}
                  >
                    {tab.name}
                  </div>
                ))}
              </div>

              <div className="link-wrapper">
                {tabs.find((tab) => tab.id === activeTab)?.links?.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-item"
                  >
                    🔗 {link.title}
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ☀️/🌙 테마 전환 버튼 */}
      <button onClick={toggleTheme} className="theme-toggle-btn" title="다크 모드 전환">
        {isDarkMode ? '🌙' : '☀️'}
      </button>
    </div>
  );
}

export default UserPage;