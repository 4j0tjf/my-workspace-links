import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './index.css'; 

/* --- 🌐 기본 아이콘 (지구본 모양의 SVG) --- */
const DEFAULT_FAVICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239aa0a6"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 015.08 16zm2.95-8H5.08a7.987 7.987 0 013.9-3.56c-.6.11-1.06.31-1.38.56zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm1.2 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg>';

/* --- 🌐 파비콘(Favicon) 이미지 URL 자동 생성 함수 --- */
const getFaviconUrl = (url) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (error) {
    return DEFAULT_FAVICON; // 주소 형식이 아예 잘못된 경우 기본 아이콘 반환
  }
};

/* --- 🔍 텍스트 하이라이트 컴포넌트 --- */
function HighlightText({ text, highlight }) {
  if (!highlight.trim()) return <span>{text}</span>;
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark');
    }
  }, []);

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

      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tab-active)', display: 'flex', alignItems: 'center' }}>
          {/* Lucide Search Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        <input 
          type="text" 
          placeholder="찾고 싶은 링크 제목이나 주소를 검색하세요..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          style={{ 
            width: '100%', 
            padding: '12px 12px 12px 42px', /* 왼쪽 여백을 42px로 주어 아이콘과 안 겹치게 함 */
            fontSize: '16px', 
            borderRadius: '8px', 
            border: '2px solid var(--tab-active)', 
            boxSizing: 'border-box',
            backgroundColor: 'var(--card-bg)', 
            color: 'var(--text-color)',
            outline: 'none'
          }} 
        />
      </div>
      
      {searchQuery.trim() !== '' ? (
        <div style={{ background: 'var(--hover-bg)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0 }}>🔎 검색 결과 ({searchResults.length}건)</h3>
          {searchResults.length === 0 ? (
            <p style={{ color: 'var(--tab-inactive)' }}>일치하는 링크가 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {searchResults.map((res, i) => (
                <li key={i} style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', marginBottom: '10px', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', transition: 'background-color 0.2s' }}>
                  
                  <a href={res.link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-color)', flex: 1, wordBreak: 'break-all' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--hover-bg)', color: 'var(--tab-active)', fontSize: '12px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                      📂 {res.tab.name}
                    </span><br/>
                    
                    <strong style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {/* ✨ onError 속성 추가: 이미지 로딩 실패 시 기본 아이콘으로 대체 */}
                      <img 
                        src={getFaviconUrl(res.link.url)} 
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_FAVICON; }}
                        alt="" 
                        style={{ width: '18px', height: '18px', borderRadius: '3px', flexShrink: 0 }} 
                      />
                      <HighlightText text={res.link.title} highlight={searchQuery} />
                    </strong>
                    
                    <span style={{ color: 'var(--tab-inactive)', fontSize: '13px' }}>
                      <HighlightText text={res.link.url} highlight={searchQuery} />
                    </span>
                  </a>

                  <button 
                    onClick={() => { setActiveTab(res.tab.id); setSearchQuery(''); }}
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
                      padding: '10px 20px', cursor: 'pointer',
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
                    style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    {/* ✨ onError 속성 추가: 이미지 로딩 실패 시 기본 아이콘으로 대체 */}
                    <img 
                      src={getFaviconUrl(link.url)} 
                      onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_FAVICON; }}
                      alt="" 
                      style={{ width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0 }} 
                    />
                    <span style={{ fontWeight: '500' }}>{link.title}</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ☀️/🌙 테마 전환 버튼 (모던 아이콘 적용) */}
      <button 
        onClick={toggleTheme} 
        className="theme-toggle-btn" 
        title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
        style={{ color: 'var(--text-color)' }} /* 테마에 맞춰 아이콘 색상이 자동 변경되도록 설정 */
      >
        {isDarkMode ? (
          /* 🌙 다크 모드일 때 보여줄 '달(Moon)' 아이콘 */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        ) : (
          /* ☀️ 라이트 모드일 때 보여줄 '해(Sun)' 아이콘 */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        )}
      </button>
    </div>
  );
}

export default UserPage;