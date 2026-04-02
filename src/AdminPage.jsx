import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';

function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [tabs, setTabs] = useState([]);
  const [newTabName, setNewTabName] = useState('');
  const [newLinkInputs, setNewLinkInputs] = useState({});

  // ✏️ [수정 기능] 상태 관리
  const [editingTabId, setEditingTabId] = useState(null);
  const [editTabNameInput, setEditTabNameInput] = useState('');

  const [editingLink, setEditingLink] = useState({ tabId: null, index: null });
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');

  // 데이터 불러오기
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

  /* ------------------- 탭(Tab) 관련 함수 ------------------- */
  const handleAddTab = async () => {
    if (!newTabName.trim()) return alert('탭 이름을 입력해주세요.');
    try {
      await addDoc(collection(db, 'tabs'), { name: newTabName, links: [], createdAt: serverTimestamp() });
      setNewTabName('');
    } catch (error) { alert('탭 추가 오류'); }
  };

  const handleDeleteTab = async (tabId) => {
    if (window.confirm('이 탭과 안에 있는 모든 링크를 정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'tabs', tabId));
    }
  };

  const handleSaveEditTab = async (tabId) => {
    if (!editTabNameInput.trim()) return alert('탭 이름을 입력해주세요.');
    await updateDoc(doc(db, 'tabs', tabId), { name: editTabNameInput });
    setEditingTabId(null);
  };

  /* ------------------- 링크(Link) 관련 함수 ------------------- */
  const handleLinkInputChange = (tabId, field, value) => {
    setNewLinkInputs(prev => ({ ...prev, [tabId]: { ...prev[tabId], [field]: value } }));
  };

  const handleAddLink = async (tabId) => {
    const input = newLinkInputs[tabId];
    if (!input || !input.title || !input.url) return alert('제목과 URL을 입력해주세요.');
    await updateDoc(doc(db, 'tabs', tabId), { links: arrayUnion({ title: input.title, url: input.url }) });
    setNewLinkInputs({ ...newLinkInputs, [tabId]: { title: '', url: '' } });
  };

  const handleDeleteLink = async (tabId, linkObj) => {
    if (window.confirm(`'${linkObj.title}' 링크를 삭제하시겠습니까?`)) {
      await updateDoc(doc(db, 'tabs', tabId), { links: arrayRemove(linkObj) });
    }
  };

  const handleSaveEditLink = async (tabId) => {
    if (!editLinkTitle || !editLinkUrl) return alert('제목과 URL을 입력해주세요.');
    const tab = tabs.find(t => t.id === tabId);
    const updatedLinks = [...tab.links];
    updatedLinks[editingLink.index] = { title: editLinkTitle, url: editLinkUrl };
    
    await updateDoc(doc(db, 'tabs', tabId), { links: updatedLinks });
    setEditingLink({ tabId: null, index: null }); // 수정 모드 종료
  };

  /* ------------------- 화면 렌더링 ------------------- */
  if (isLoggedIn) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ color: '#d32f2f', margin: 0 }}>⚙️ 링크 관리 어드민</h2>
          <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>로그아웃</button>
        </div>
        <hr style={{ margin: '20px 0' }} />

        {/* 새 탭 추가 */}
        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h3>새 탭 만들기</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="새 탭 이름" value={newTabName} onChange={(e) => setNewTabName(e.target.value)} style={{ flex: 1, padding: '10px' }} />
            <button onClick={handleAddTab} style={{ padding: '10px 15px', backgroundColor: '#4caf50', color: 'white', border: 'none', cursor: 'pointer' }}>탭 추가</button>
          </div>
        </div>

        {/* 기존 탭 목록 관리 */}
        <h3>기존 탭 관리</h3>
        {tabs.map((tab) => (
          <div key={tab.id} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
            
            {/* 📌 탭 이름 영역 (일반 모드 vs 수정 모드) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              {editingTabId === tab.id ? (
                <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
                  <input type="text" value={editTabNameInput} onChange={(e) => setEditTabNameInput(e.target.value)} style={{ flex: 1, padding: '5px' }} />
                  <button onClick={() => handleSaveEditTab(tab.id)} style={{ padding: '5px 10px', background: '#1a73e8', color: 'white', border: 'none' }}>저장</button>
                  <button onClick={() => setEditingTabId(null)} style={{ padding: '5px 10px' }}>취소</button>
                </div>
              ) : (
                <>
                  <h4 style={{ margin: 0, color: '#1a73e8', fontSize: '18px' }}>📌 {tab.name}</h4>
                  <div>
                    <button onClick={() => { setEditingTabId(tab.id); setEditTabNameInput(tab.name); }} style={{ marginRight: '5px', padding: '5px 10px', cursor: 'pointer' }}>✏️ 수정</button>
                    <button onClick={() => handleDeleteTab(tab.id)} style={{ padding: '5px 10px', color: 'white', background: '#d32f2f', border: 'none', cursor: 'pointer' }}>🗑️ 삭제</button>
                  </div>
                </>
              )}
            </div>

            {/* 🔗 링크 목록 영역 */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0' }}>
              {tab.links?.map((link, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fff', border: '1px solid #eee', marginBottom: '5px', borderRadius: '4px', flexWrap: 'wrap', gap: '10px' }}>
                  
                  {/* 링크 일반 모드 vs 수정 모드 */}
                  {editingLink.tabId === tab.id && editingLink.index === idx ? (
                    <div style={{ display: 'flex', gap: '5px', width: '100%', flexWrap: 'wrap' }}>
                      <input type="text" value={editLinkTitle} onChange={(e) => setEditLinkTitle(e.target.value)} style={{ flex: 1, padding: '5px', minWidth: '100px' }} />
                      <input type="text" value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)} style={{ flex: 2, padding: '5px', minWidth: '150px' }} />
                      <button onClick={() => handleSaveEditLink(tab.id)} style={{ padding: '5px 10px', background: '#1a73e8', color: 'white', border: 'none' }}>저장</button>
                      <button onClick={() => setEditingLink({ tabId: null, index: null })} style={{ padding: '5px 10px' }}>취소</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ wordBreak: 'break-all' }}>
                        <strong>{link.title}</strong> <br/>
                        <span style={{ color: 'gray', fontSize: '13px' }}>{link.url}</span>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <button onClick={() => { setEditingLink({ tabId: tab.id, index: idx }); setEditLinkTitle(link.title); setEditLinkUrl(link.url); }} style={{ marginRight: '5px', padding: '5px', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => handleDeleteLink(tab.id, link)} style={{ padding: '5px', cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* 이 탭에 새 링크 추가하기 폼 */}
            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="새 링크 제목" value={newLinkInputs[tab.id]?.title || ''} onChange={(e) => handleLinkInputChange(tab.id, 'title', e.target.value)} style={{ flex: 1, padding: '8px', minWidth: '100px' }} />
              <input type="text" placeholder="URL (https://...)" value={newLinkInputs[tab.id]?.url || ''} onChange={(e) => handleLinkInputChange(tab.id, 'url', e.target.value)} style={{ flex: 2, padding: '8px', minWidth: '150px' }} />
              <button onClick={() => handleAddLink(tab.id)} style={{ padding: '8px 15px', backgroundColor: '#1a73e8', color: 'white', border: 'none', cursor: 'pointer' }}>+ 추가</button>
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