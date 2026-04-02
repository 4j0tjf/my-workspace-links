import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './index.css'; 

function UserPage() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);

  // 🌙 다크모드 상태 관리 (기본값: false = 라이트모드)
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 1. 첫 접속 시 이전 테마 설정 불러오기
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark');
    }
  }, []);

  // 2. 테마 전환 함수
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

  // 파이어베이스 데이터 불러오기
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

  if (loading) return <div className="container">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="container">
      <h2 className="title">업무 링크 모음</h2>
      
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
                  // CSS 변수를 적용하여 다크모드 시 자동으로 색이 변하도록 처리
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

      {/* ☀️/🌙 테마 전환 버튼 */}
      <button onClick={toggleTheme} className="theme-toggle-btn" title="다크 모드 전환">
        {isDarkMode ? '🌙' : '☀️'}
      </button>
    </div>
  );
}

export default UserPage;