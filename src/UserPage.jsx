import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

function UserPage() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);

  // 컴포넌트가 화면에 나타날 때 Firebase에서 데이터를 실시간으로 불러옴
  useEffect(() => {
    // 'tabs' 컬렉션의 데이터를 생성 시간(createdAt) 순으로 가져오는 쿼리
    const q = query(collection(db, 'tabs'), orderBy('createdAt', 'asc'));
    
    // onSnapshot은 DB에 변화가 생길 때마다 자동으로 화면을 업데이트해줍니다.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTabs(tabData);
      
      // 처음 로딩 시 데이터가 있으면 첫 번째 탭을 자동으로 선택
      if (tabData.length > 0 && activeTab === '') {
        setActiveTab(tabData[0].id);
      }
      setLoading(false);
    });

    return () => unsubscribe(); // 화면이 꺼질 때 연결 종료
  }, [activeTab]);

  if (loading) return <div style={{ padding: '40px' }}>데이터를 불러오는 중입니다...</div>;

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ marginBottom: '30px', color: '#333' }}>업무 링크 모음</h2>
      
      {tabs.length === 0 ? (
        <p>등록된 탭이 없습니다. 어드민 페이지에서 탭을 추가해주세요.</p>
      ) : (
        <>
          {/* 탭 영역 */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
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

          {/* 링크 목록 영역 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tabs.find((tab) => tab.id === activeTab)?.links?.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '16px 20px',
                  border: '1px solid #dadce0',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: '#202124',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
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