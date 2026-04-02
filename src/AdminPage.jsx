import { useState, useEffect, useRef } from 'react'; // 👈 useRef 추가됨
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import toast, { Toaster } from 'react-hot-toast';

/* --- 🌐 URL 검증 함수 --- */
const formatAndValidateUrl = (url) => {
  let formattedUrl = url.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;
  try { new URL(formattedUrl); return formattedUrl; } 
  catch (error) { return null; }
};

/* --- 🔍 하이라이트 컴포넌트 --- */
function HighlightText({ text, highlight }) {
  if (!highlight.trim()) return <span>{text}</span>;
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapeRegExp(highlight)})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => regex.test(part) ? (
        <span key={i} style={{ backgroundColor: '#ffeb3b', color: '#000', fontWeight: 'bold', padding: '0 2px', borderRadius: '3px' }}>{part}</span>
      ) : <span key={i}>{part}</span>)}
    </span>
  );
}

/* --- 드래그 가능한 탭 아이템 --- */
function SortableTabItem({ id, tab, activeTabId, setActiveTabId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, padding: '10px 20px', cursor: 'pointer',
    fontWeight: activeTabId === tab.id ? 'bold' : 'normal', color: activeTabId === tab.id ? '#d32f2f' : '#5f6368',
    borderBottom: activeTabId === tab.id ? '3px solid #d32f2f' : '3px solid transparent', whiteSpace: 'nowrap', userSelect: 'none'
  };
  return (
    <div ref={setNodeRef} style={style} onClick={() => setActiveTabId(tab.id)} {...attributes} {...listeners}>
      ☰ {tab.name}
    </div>
  );
}

/* --- 드래그 가능한 링크 아이템 --- */
function SortableLinkItem({ id, link, idx, onEdit, onDelete, editingIndex, editTitle, setEditTitle, editUrl, setEditUrl, onSave, onCancel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', marginBottom: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '12px', gap: '10px'
  };
  return (
    <li ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#ccc' }}>⠿</div>
      <div style={{ flex: 1 }}>
        {editingIndex === idx ? (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ flex: 1, padding: '5px' }} />
            <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)} style={{ flex: 2, padding: '5px' }} />
            <button onClick={onSave} style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '5px' }}>저장</button>
            <button onClick={onCancel} style={{ padding: '5px' }}>취소</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ wordBreak: 'break-all' }}>
              <strong>{link.title}</strong> <br/>
              <span style={{ color: 'gray', fontSize: '12px' }}>{link.url}</span>
            </div>
            <div style={{ flexShrink: 0 }}>
              <button onClick={() => onEdit(idx, link)} style={{ marginRight: '5px' }}>✏️</button>
              <button onClick={() => onDelete(link)}>🗑️</button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');

  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState(null);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 📂 파일 업로드 창을 띄우기 위한 참조(ref)
  const fileInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, 'tabs'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTabs(tabData);
      if (tabData.length > 0 && (!activeTabId || !tabData.find(t => t.id === activeTabId))) {
        setActiveTabId(tabData[0].id);
      }
    });
    return () => unsubscribe();
  }, [isLoggedIn, activeTabId]);

  /* --- 💾 데이터 백업 함수 --- */
  const handleExportData = () => {
    if (tabs.length === 0) return toast.error('백업할 데이터가 없습니다.');
    try {
      const jsonString = JSON.stringify(tabs, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('데이터가 백업되었습니다! 💾');
    } catch (error) { toast.error('백업 중 오류가 발생했습니다.'); }
  };

  /* --- 📂 데이터 복구 (Import) 함수 --- */
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 1. 안전을 위한 경고창 띄우기
    if (!window.confirm('🚨 주의! 기존의 모든 탭과 링크가 삭제되고 업로드한 파일의 내용으로 덮어씌워집니다. 계속하시겠습니까?')) {
      event.target.value = ''; // 취소 시 파일 선택 초기화
      return;
    }

    // 2. 파일 읽기
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData)) throw new Error("잘못된 파일 형식입니다.");

        // 3. 파이어베이스 Batch 업데이트 시작
        const batch = writeBatch(db);

        // 3-1. 기존 파이어베이스에 있는 모든 탭 데이터 삭제
        tabs.forEach(tab => {
          batch.delete(doc(db, 'tabs', tab.id));
        });

        // 3-2. 백업 파일에서 가져온 새로운 데이터를 추가
        importedData.forEach((tabData, index) => {
          const newDocRef = doc(collection(db, 'tabs')); // 새로운 임의의 ID 생성
          batch.set(newDocRef, {
            name: tabData.name,
            links: tabData.links || [],
            order: index, // 백업 당시의 순서 유지
            createdAt: serverTimestamp()
          });
        });

        // 4. 파이어베이스에 일괄 적용(Commit)
        await batch.commit();
        toast.success('데이터가 성공적으로 복구되었습니다! 🚀');
        event.target.value = ''; // 성공 후 파일 선택 초기화

      } catch (error) {
        toast.error('파일을 읽는 데 실패했습니다. 올바른 백업 파일인지 확인해 주세요.');
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); setIsLoggedIn(true); toast.success('관리자로 로그인되었습니다!'); } 
    catch(err) { toast.error('로그인 실패: 이메일과 비밀번호를 확인해주세요.'); }
  };

  const handleLogout = () => { signOut(auth); setIsLoggedIn(false); toast('로그아웃 되었습니다.', { icon: '👋' }); };

  const handleAddTab = async () => {
    const trimmedName = newTabName.trim();
    if (!trimmedName) return toast.error('탭 이름을 입력해주세요.');
    const isDuplicate = tabs.some(tab => tab.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) return toast.error(`'${trimmedName}'은(는) 이미 존재하는 탭입니다.`);

    try {
      await addDoc(collection(db, 'tabs'), { name: trimmedName, links: [], order: tabs.length, createdAt: serverTimestamp() });
      setNewTabName(''); setIsModalOpen(false); toast.success('새 탭이 추가되었습니다!');
    } catch (error) { toast.error('탭 추가 중 오류가 발생했습니다.'); }
  };

  const handleAddLink = async () => {
    if (!newLinkTitle || !newLinkUrl) return toast.error('제목과 URL을 모두 입력해주세요.');
    const validatedUrl = formatAndValidateUrl(newLinkUrl);
    if (!validatedUrl) return toast.error('올바른 웹사이트 주소 형식이 아닙니다.');

    const currentTab = tabs.find(t => t.id === activeTabId);
    await updateDoc(doc(db, 'tabs', activeTabId), { links: [...(currentTab.links || []), { title: newLinkTitle, url: validatedUrl }] });
    setNewLinkTitle(''); setNewLinkUrl(''); toast.success('링크가 추가되었습니다!');
  };

  const handleTabDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex(t => t.id === active.id);
    const newIndex = tabs.findIndex(t => t.id === over.id);
    const newTabs = arrayMove(tabs, oldIndex, newIndex);
    const batch = writeBatch(db);
    newTabs.forEach((tab, index) => { batch.update(doc(db, 'tabs', tab.id), { order: index }); });
    await batch.commit();
  };

  const handleLinkDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentTab = tabs.find(t => t.id === activeTabId);
    const oldIndex = parseInt(active.id.split('-')[1]);
    const newIndex = parseInt(over.id.split('-')[1]);
    const newLinks = arrayMove(currentTab.links, oldIndex, newIndex);
    await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks });
  };

  const searchResults = tabs.flatMap(tab => 
    (tab.links || []).map((link, index) => ({ tab, link, index }))
      .filter(({ link }) => link.title.toLowerCase().includes(searchQuery.toLowerCase()) || link.url.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <Toaster position="top-center" />
        <h2>로그인</h2>
        <form onSubmit={handleLogin} style={{ display: 'inline-flex', flexDirection: 'column', gap: '10px' }}>
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '10px' }} />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px' }} />
          <button type="submit" style={{ padding: '10px', background: '#d32f2f', color: 'white', border: 'none' }}>로그인</button>
        </form>
      </div>
    );
  }

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <Toaster position="bottom-center" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>⚙️ 어드민 도구</h2>
        <button onClick={handleLogout}>로그아웃</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input type="text" placeholder="🔍 링크 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #1a73e8', boxSizing: 'border-box' }} />
      </div>

      {searchQuery.trim() !== '' ? (
        <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0 }}>🔎 검색 결과 ({searchResults.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {searchResults.map((res, i) => (
              <li key={i} style={{ backgroundColor: '#fff', border: '1px solid #eee', marginBottom: '10px', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ wordBreak: 'break-all' }}>
                   <span style={{ fontSize: '11px', color: '#1a73e8', fontWeight: 'bold' }}>📂 {res.tab.name}</span><br/>
                   <HighlightText text={res.link.title} highlight={searchQuery} /><br/>
                   <small style={{ color: 'gray' }}><HighlightText text={res.link.url} highlight={searchQuery} /></small>
                </div>
                <button onClick={() => { setActiveTabId(res.tab.id); setSearchQuery(''); }} style={{ background: '#333', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>이동</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {/* ✨ 기능 버튼들을 3개로 확장 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + 새 탭 만들기
            </button>
            
            {/* 데이터 복구용 숨겨진 input 태그 */}
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportData} 
            />
            <button 
              onClick={() => fileInputRef.current.click()} // 클릭 시 input 파일 창을 대신 열어줌
              style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📂 데이터 복구 (.json)
            </button>
            
            <button 
              onClick={handleExportData}
              style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              💾 데이터 백업 (.json)
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
            <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
              <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid #eee', marginBottom: '20px' }}>
                {tabs.map(tab => (
                  <SortableTabItem key={tab.id} id={tab.id} tab={tab} activeTabId={activeTabId} setActiveTabId={setActiveTabId} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {activeTab && (
            <div style={{ background: '#fcfcfc', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
              <h3>📂 {activeTab.name} 관리</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLinkDragEnd}>
                <SortableContext items={(activeTab.links || []).map((_, i) => `link-${i}`)} strategy={verticalListSortingStrategy}>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {activeTab.links?.map((link, idx) => (
                      <SortableLinkItem 
                        key={`link-${idx}`} id={`link-${idx}`} link={link} idx={idx} 
                        editingIndex={editingLinkIndex} editTitle={editLinkTitle} setEditTitle={setEditLinkTitle} editUrl={editLinkUrl} setEditUrl={setEditLinkUrl} 
                        onEdit={(i, l) => { setEditingLinkIndex(i); setEditLinkTitle(l.title); setEditLinkUrl(l.url); }} 
                        onDelete={async (l) => { 
                          if(window.confirm('삭제하시겠습니까?')) {
                            await updateDoc(doc(db, 'tabs', activeTabId), { links: activeTab.links.filter(item => item !== l) }); 
                            toast.success('삭제되었습니다.');
                          }
                        }} 
                        onSave={async () => { 
                          const validatedUrl = formatAndValidateUrl(editLinkUrl);
                          if (!validatedUrl) return toast.error('올바른 웹사이트 주소를 입력해주세요!');
                          const newLinks = [...activeTab.links]; 
                          newLinks[idx] = { title: editLinkTitle, url: validatedUrl }; 
                          await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks }); 
                          setEditingLinkIndex(null); 
                          toast.success('성공적으로 수정되었습니다.');
                        }} 
                        onCancel={() => setEditingLinkIndex(null)} 
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              <div style={{ display: 'flex', gap: '5px', marginTop: '20px', background: '#eee', padding: '15px', borderRadius: '8px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="제목" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '8px', minWidth: '100px' }} />
                <input type="text" placeholder="URL (google.com만 쳐도 됨)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} style={{ flex: 2, padding: '8px', minWidth: '150px' }} />
                <button onClick={handleAddLink} style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '8px 15px', whiteSpace: 'nowrap' }}>추가</button>
              </div>
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>새 탭 만들기</h3>
            <p style={{ fontSize: '13px', color: 'gray' }}>중복되지 않는 이름을 입력해주세요.</p>
            <input 
              type="text" placeholder="탭 이름 입력" value={newTabName} 
              onChange={e => setNewTabName(e.target.value)} autoFocus onKeyDown={(e) => { if(e.key === 'Enter') handleAddTab(); }}
            />
            <div className="modal-btns">
              <button onClick={() => { setIsModalOpen(false); setNewTabName(''); }} className="btn-cancel">취소</button>
              <button onClick={handleAddTab} className="btn-confirm">추가하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;