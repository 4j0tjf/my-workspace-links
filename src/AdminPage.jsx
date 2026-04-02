import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, arrayUnion, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';

function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [tabs, setTabs] = useState([]);
  const [newTabName, setNewTabName] = useState('');
  const [newLinkInputs, setNewLinkInputs] = useState({}); // 각 탭마다의 링크 입력값 상태 관리

  // 로그인 시 기존 탭 목록 불러오기
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, 'tabs'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTabs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
    } catch (error) {
      alert("로그인 실패: 아이디나 비밀번호를 확인해주세요.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setIsLoggedIn(false);
  };

  // 1️⃣ 새 탭 추가 함수
  const handleAddTab = async () => {
    if (!newTabName.trim()) return alert('탭 이름을 입력해주세요.');
    try {
      await addDoc(collection(db, 'tabs'), {
        name: newTabName,
        links: [], // 처음엔 빈 링크 배열로 시작
        createdAt: serverTimestamp() // 정렬을 위해 생성 시간 기록
      });
      setNewTabName(''); // 입력창 초기화
    } catch (error) {
      alert('탭 추가 중 오류가 발생했습니다.');
    }
  };

  // 2️⃣ 링크 추가 입력값 변경 관리
  const handleLinkInputChange = (tabId, field, value) => {
    setNewLinkInputs(prev => ({
      ...prev,
      [tabId]: { ...prev[tabId], [field]: value }
    }));
  };

  // 3️⃣ 특정 탭에 링크 추가 함수
  const handleAddLink = async (tabId) => {
    const input = newLinkInputs[tabId];
    if (!input || !input.title || !input.url) return alert('링크 제목과 URL을 모두 입력해주세요.');
    
    try {
      const tabRef = doc(db, 'tabs', tabId);
      // DB의 해당 탭 문서 안의 'links' 배열에 새 데이터를 추가(arrayUnion)합니다.
      await updateDoc(tabRef, {
        links: arrayUnion({ title: input.title, url: input.url })
      });
      // 입력창 초기화
      setNewLinkInputs({ ...newLinkInputs, [tabId]: { title: '', url: '' } });
    } catch (error) {
      alert('링크 추가 중 오류가 발생했습니다.');
    }
  };

  if (isLoggedIn) {
    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#d32f2f' }}>⚙️ 링크 관리 어드민</h2>
          <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>로그아웃</button>
        </div>
        <hr style={{ margin: '20px 0' }} />

        {/* 새 탭 추가 영역 */}
        <div style={{ marginBottom: '40px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h3>새 탭 만들기</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="예: QA 테스트 환경" 
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              style={{ flex: 1, padding: '10px' }}
            />
            <button onClick={handleAddTab} style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: 'white', border: 'none', cursor: 'pointer' }}>
              탭 추가
            </button>
          </div>
        </div>

        {/* 기존 탭 및 링크 관리 영역 */}
        <h3>기존 탭 관리</h3>
        {tabs.map((tab) => (
          <div key={tab.id} style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#1a73e8' }}>📌 {tab.name}</h4>
            
            {/* 현재 등록된 링크 목록 보여주기 */}
            <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
              {tab.links?.map((link, idx) => (
                <li key={idx} style={{ marginBottom: '5px' }}>
                  <strong>{link.title}</strong> - <span style={{ color: 'gray', fontSize: '14px' }}>{link.url}</span>
                </li>
              ))}
            </ul>

            {/* 이 탭에 새 링크 추가하기 폼 */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input 
                type="text" 
                placeholder="링크 제목 (예: 어드민 페이지)" 
                value={newLinkInputs[tab.id]?.title || ''}
                onChange={(e) => handleLinkInputChange(tab.id, 'title', e.target.value)}
                style={{ flex: 1, padding: '8px' }}
              />
              <input 
                type="text" 
                placeholder="URL (예: https://...)" 
                value={newLinkInputs[tab.id]?.url || ''}
                onChange={(e) => handleLinkInputChange(tab.id, 'url', e.target.value)}
                style={{ flex: 2, padding: '8px' }}
              />
              <button onClick={() => handleAddLink(tab.id)} style={{ padding: '8px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', cursor: 'pointer' }}>
                링크 추가
              </button>
            </div>
          </div>
        ))}

      </div>
    );
  }

  // 로그인 전 화면
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#d32f2f' }}>어드민 로그인</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
        <input type="email" placeholder="이메일 (아이디)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px' }} />
        <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '12px' }} />
        <button type="submit" style={{ padding: '12px', backgroundColor: '#d32f2f', color: 'white', border: 'none', cursor: 'pointer' }}>로그인</button>
      </form>
    </div>
  );
}

export default AdminPage;