import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './index.css'; // 👈 방금 만든 CSS 파일을 불러옵니다.

function UserPage() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tabs'), orderBy('createdAt', 'asc'));
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
                  color: activeTab === tab.id ? '#1a73e8' : '#5f6368',
                  borderBottom: activeTab === tab.id ? '3px solid #1a73e8' : '3px solid transparent',
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
    </div>
  );
}

export default UserPage;