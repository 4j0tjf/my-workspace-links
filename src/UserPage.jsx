import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './index.css'; 

/* --- 🌐 파비콘(Favicon) 이미지 URL 자동 생성 함수 --- */
const getFaviconUrl = (url) => {
  try {
    // URL에서 도메인(hostname)만 추출 (예: https://www.google.com/search -> www.google.com)
    const domain = new URL(url).hostname;
    // 구글 파비콘 API (sz=64는 64x64 픽셀의 선명한 화질을 의미함)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (error) {
    return ''; // URL이 잘못된 경우 빈 문자열 반환
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
                    
                    {/* ✨ 검색 결과 영역에 파비콘 추가 */}
                    <strong style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <img src={getFaviconUrl(res.link.url)} alt="" style={{ width: '18px', height: '18px', borderRadius: '3px', flexShrink: 0 }} />
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
                    // ✨ 일반 링크 목록 영역에도 flex 속성을 주어 파비콘과 텍스트를 나란히 배치
                    style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <img 
                      src={getFaviconUrl(link.url)} 
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

      <button onClick={toggleTheme} className="theme-toggle-btn" title="다크 모드 전환">
        {isDarkMode ? '🌙' : '☀️'}
      </button>
    </div>
  );
}

export default UserPage;