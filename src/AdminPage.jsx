import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';

function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(''); // 👈 유저 페이지처럼 현재 선택된 탭 관리

  // 탭 관련 상태
  const [newTabName, setNewTabName] = useState('');
  const [editingTabId, setEditingTabId] = useState(null);
  const [editTabNameInput, setEditTabNameInput] = useState('');

  // 링크 관련 상태 (한 번에 한 탭만 관리하므로 상태가 단순해집니다)
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  
  const [editingLinkIndex, setEditingLinkIndex] = useState(null);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');

  // 데이터 불러오기 및 활성 탭 설정
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, 'tabs'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTabs(tabData);
      
      // 처음 로딩되거나, 현재 보고 있던 탭이 삭제된 경우 첫 번째 탭을 보여줌
      if (tabData.length > 0 && (!activeTabId || !tabData.find(t => t.id === activeTabId))) {
        setActiveTabId(tabData[0].id);
      }
    });
    return () => unsubscribe();
  }, [isLoggedIn, activeTabId]);

  /* --- 인증 함수 --- */
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
    } catch (error) { alert("로그인 실패: 아이디나 비밀번호를 확인해주세요."); }
  };
  const handleLogout = () => { signOut(auth); setIsLoggedIn(false); };

  /* --- 탭(Tab) 관리 함수 --- */
  const handleAddTab = async () => {
    if (!newTabName.trim()) return alert('탭 이름을 입력해주세요.');
    try {
      const docRef = await addDoc(collection(db, 'tabs'), { name: newTabName, links: [], createdAt: serverTimestamp() });
      setNewTabName('');
      setActiveTabId(docRef.id); // 방금 새로 만든 탭으로 화면 즉시 이동
    } catch (error) { alert('탭 추가 오류'); }
  };

  const handleDeleteTab = async (tabId) => {
    if (window.confirm('이 탭과 안에 있는 모든 링크를 정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'tabs', tabId));
      setEditingTabId(null);
    }
  };

  const handleSaveEditTab = async (tabId) => {
    if (!editTabNameInput.trim()) return alert('탭 이름을 입력해주세요.');
    await updateDoc(doc(db, 'tabs', tabId), { name: editTabNameInput });
    setEditingTabId(null);
  };

  /* --- 링크(Link) 관리 함수 --- */
  const handleAddLink = async () => {
    if (!newLinkTitle || !newLinkUrl) return alert('제목과 URL을 입력해주세요.');
    await updateDoc(doc(db, 'tabs', activeTabId), { 
      links: arrayUnion({ title: newLinkTitle, url: newLinkUrl }) 
    });
    setNewLinkTitle(''); // 입력창 초기화
    setNewLinkUrl('');
  };

  const handleDeleteLink = async (linkObj) => {
    if (window.confirm(`'${linkObj.title}' 링크를 삭제하시겠습니까?`)) {
      await updateDoc(doc(db, 'tabs', activeTabId), { links: arrayRemove(linkObj) });
    }
  };

  const handleSaveEditLink = async () => {
    if (!editLinkTitle || !editLinkUrl) return alert('제목과 URL을 입력해주세요.');
    const activeTab = tabs.find(t => t.id === activeTabId);
    const updatedLinks = [...activeTab.links];
    updatedLinks[editingLinkIndex] = { title: editLinkTitle, url: editLinkUrl };
    
    await updateDoc(doc(db, 'tabs', activeTabId), { links: updatedLinks });
    setEditingLinkIndex(null); // 수정 모드 종료
  };

  /* --- 화면 렌더링 --- */
  if (isLoggedIn) {
    const activeTab = tabs.find(t => t.id === activeTabId); // 현재 선택된 탭의 데이터

    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
        {/* 상단 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ color: '#d32f2f', margin: 0 }}>⚙️ 어드민: 업무 링크 관리</h2>
          <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>로그아웃</button>
        </div>
        <hr style={{ margin: '20px 0' }} />

        {/* 새 탭 추가 영역 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="새 탭 이름 추가..." value={newTabName} onChange={(e) => setNewTabName(e.target.value)} style={{ flex: 1, padding: '10px', minWidth: '150px' }} />
          <button onClick={handleAddTab} style={{ padding: '10px 20px', backgroundColor: '#333', color: 'white', border: 'none', cursor: 'pointer' }}>+ 탭 추가</button>
        </div>

        {/* 탭 메뉴 (유저 페이지처럼 가로로 배치) */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid #e0e0e0', marginBottom: '20px', whiteSpace: 'nowrap' }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setEditingTabId(null);
                setEditingLinkIndex(null);
              }}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                fontWeight: activeTabId === tab.id ? 'bold' : 'normal',
                color: activeTabId === tab.id ? '#d32f2f' : '#5f6368',
                borderBottom: activeTabId === tab.id ? '3px solid #d32f2f' : '3px solid transparent',
                marginBottom: '-2px'
              }}
            >
              {tab.name}
            </div>
          ))}
        </div>

        {/* 선택된 탭의 관리 영역 */}
        {activeTab && (
          <div style={{ padding: '20px', backgroundColor: '#fdfdfd', border: '1px solid #ddd', borderRadius: '8px' }}>
            
            {/* 활성 탭 이름 수정 및 삭제 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              {editingTabId === activeTab.id ? (
                <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
                  <input type="text" value={editTabNameInput} onChange={(e) => setEditTabNameInput(e.target.value)} style={{ flex: 1, padding: '8px' }} />
                  <button onClick={() => handleSaveEditTab(activeTab.id)} style={{ padding: '8px 15px', background: '#1a73e8', color: 'white', border: 'none' }}>저장</button>
                  <button onClick={() => setEditingTabId(null)} style={{ padding: '8px 15px' }}>취소</button>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: 0, color: '#333' }}>📂 {activeTab.name}</h3>
                  <div>
                    <button onClick={() => { setEditingTabId(activeTab.id); setEditTabNameInput(activeTab.name); }} style={{ marginRight: '5px', padding: '6px 12px', cursor: 'pointer' }}>탭 이름 수정</button>
                    <button onClick={() => handleDeleteTab(activeTab.id)} style={{ padding: '6px 12px', color: 'white', background: '#d32f2f', border: 'none', cursor: 'pointer' }}>현재 탭 삭제</button>
                  </div>
                </>
              )}
            </div>

            {/* 링크 목록 */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
              {activeTab.links?.length === 0 && <p style={{ color: 'gray' }}>등록된 링크가 없습니다.</p>}
              {activeTab.links?.map((link, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#fff', border: '1px solid #eee', marginBottom: '8px', borderRadius: '4px', flexWrap: 'wrap', gap: '10px' }}>
                  
                  {/* 링크 수정 모드 */}
                  {editingLinkIndex === idx ? (
                    <div style={{ display: 'flex', gap: '5px', width: '100%', flexWrap: 'wrap' }}>
                      <input type="text" value={editLinkTitle} onChange={(e) => setEditLinkTitle(e.target.value)} style={{ flex: 1, padding: '8px', minWidth: '100px' }} />
                      <input type="text" value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)} style={{ flex: 2, padding: '8px', minWidth: '150px' }} />
                      <button onClick={handleSaveEditLink} style={{ padding: '8px 15px', background: '#1a73e8', color: 'white', border: 'none' }}>저장</button>
                      <button onClick={() => setEditingLinkIndex(null)} style={{ padding: '8px 15px' }}>취소</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ wordBreak: 'break-all' }}>
                        <strong>{link.title}</strong> <br/>
                        <span style={{ color: 'gray', fontSize: '13px' }}>{link.url}</span>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <button onClick={() => { setEditingLinkIndex(idx); setEditLinkTitle(link.title); setEditLinkUrl(link.url); }} style={{ marginRight: '5px', padding: '6px', cursor: 'pointer' }}>✏️ 수정</button>
                        <button onClick={() => handleDeleteLink(link)} style={{ padding: '6px', cursor: 'pointer' }}>🗑️ 삭제</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* 현재 탭에 새 링크 추가 폼 */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', backgroundColor: '#f1f3f4', padding: '15px', borderRadius: '8px' }}>
              <input type="text" placeholder="새 링크 제목" value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '10px', minWidth: '100px', border: '1px solid #ccc', borderRadius: '4px' }} />
              <input type="text" placeholder="URL 주소 (https://...)" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} style={{ flex: 2, padding: '10px', minWidth: '150px', border: '1px solid #ccc', borderRadius: '4px' }} />
              <button onClick={handleAddLink} style={{ padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ 링크 추가</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 로그인 전
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#d32f2f' }}>어드민 로그인</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px' }} />
        <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '12px' }} />
        <button type="submit" style={{ padding: '12px', backgroundColor: '#d32f2f', color: 'white', border: 'none', cursor: 'pointer' }}>로그인</button>
      </form>
    </div>
  );
}

export default AdminPage;