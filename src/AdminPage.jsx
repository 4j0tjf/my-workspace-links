import { useState, useEffect, useRef } from 'react';
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
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', marginBottom: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '12px', gap: '12px'
  };
  return (
    <li ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#aaa', display: 'flex' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        {editingIndex === idx ? (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)} style={{ flex: 2, padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <button onClick={onSave} style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
            <button onClick={onCancel} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>취소</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ wordBreak: 'break-all' }}>
              <strong style={{ fontSize: '15px', color: '#202124' }}>{link.title}</strong> <br/>
              <span style={{ color: '#5f6368', fontSize: '12px' }}>{link.url}</span>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', gap: '4px' }}>
              <button onClick={() => onEdit(idx, link)} title="수정하기" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5f6368', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f3f4'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button onClick={() => onDelete(link)} title="삭제하기" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fce8e6'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              </button>
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

  // 📋 대량 추가 기능 상태
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState('');

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

  /* --- 💾 데이터 백업/복구 로직 --- */
  const handleExportData = () => {
    if (tabs.length === 0) return toast.error('백업할 데이터가 없습니다.');
    try {
      const jsonString = JSON.stringify(tabs, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url); toast.success('데이터가 백업되었습니다!');
    } catch (error) { toast.error('백업 중 오류가 발생했습니다.'); }
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!window.confirm('기존의 모든 탭과 링크가 삭제되고 업로드한 파일로 덮어씌워집니다. 계속하시겠습니까?')) {
      event.target.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData)) throw new Error("잘못된 형식");
        const batch = writeBatch(db);
        tabs.forEach(tab => batch.delete(doc(db, 'tabs', tab.id)));
        importedData.forEach((tabData, index) => {
          batch.set(doc(collection(db, 'tabs')), { name: tabData.name, links: tabData.links || [], order: index, createdAt: serverTimestamp() });
        });
        await batch.commit();
        toast.success('데이터 복구 완료!');
        event.target.value = '';
      } catch (error) { toast.error('백업 파일 형식이 올바르지 않습니다.'); event.target.value = ''; }
    };
    reader.readAsText(file);
  };

  /* --- 기본 액션 로직 --- */
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

  /* --- 📋 엑셀 대량 추가(Bulk Add) 로직 --- */
  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return toast.error('입력된 데이터가 없습니다.');
    
    const lines = bulkText.split('\n'); // 엔터(줄바꿈)를 기준으로 각 줄을 나눔
    const newLinks = [];
    let errorCount = 0;

    lines.forEach(line => {
      if (!line.trim()) return; // 빈 줄 무시
      
      // 엑셀에서 복사하면 열과 열 사이가 탭(\t)으로 구분됨
      const parts = line.split('\t'); 
      
      // 제목과 URL 최소 2개의 기둥이 있는지 확인
      if (parts.length >= 2) {
        const title = parts[0].trim();
        const rawUrl = parts[1].trim(); // 두 번째 열을 URL로 간주
        const validatedUrl = formatAndValidateUrl(rawUrl);
        
        if (title && validatedUrl) {
          newLinks.push({ title, url: validatedUrl });
        } else {
          errorCount++; // URL 형식이 틀리거나 제목이 없는 경우 에러 카운트
        }
      } else {
        errorCount++; // 열 구분이 제대로 안 된 경우
      }
    });

    if (newLinks.length === 0) {
      return toast.error('추가할 수 있는 유효한 데이터가 없습니다. (제목과 주소 형식을 확인해주세요)');
    }

    const currentTab = tabs.find(t => t.id === activeTabId);
    const updatedLinks = [...(currentTab.links || []), ...newLinks];

    await updateDoc(doc(db, 'tabs', activeTabId), { links: updatedLinks });
    
    setBulkText(''); // 텍스트창 비우기
    setShowBulkAdd(false); // 창 닫기
    toast.success(`${newLinks.length}개의 링크가 대량 추가되었습니다!`);
    if (errorCount > 0) toast.error(`${errorCount}줄의 데이터는 형식이 맞지 않아 제외되었습니다.`, { duration: 4000 });
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
        <h2 style={{ margin: 0 }}>어드민 도구</h2>
        <button onClick={handleLogout}>로그아웃</button>
      </div>

      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#1a73e8', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <input 
          type="text" placeholder="찾고 싶은 링크 제목이나 주소를 검색하세요..." 
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
          style={{ width: '100%', padding: '12px 12px 12px 42px', fontSize: '16px', borderRadius: '8px', border: '2px solid #1a73e8', boxSizing: 'border-box', outline: 'none' }} 
        />
      </div>

      {searchQuery.trim() !== '' ? (
        <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0 }}>검색 결과 ({searchResults.length})</h3>
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
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsModalOpen(true)} style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ 새 탭 만들기</button>
            <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportData} />
            <button onClick={() => fileInputRef.current.click()} style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📂 복구 (.json)</button>
            <button onClick={handleExportData} style={{ flex: 1, minWidth: '120px', padding: '12px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>💾 백업 (.json)</button>
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
                      <SortableLinkItem key={`link-${idx}`} id={`link-${idx}`} link={link} idx={idx} editingIndex={editingLinkIndex} editTitle={editLinkTitle} setEditTitle={setEditLinkTitle} editUrl={editLinkUrl} setEditUrl={setEditLinkUrl} onEdit={(i, l) => { setEditingLinkIndex(i); setEditLinkTitle(l.title); setEditLinkUrl(l.url); }} onDelete={async (l) => { if(window.confirm('삭제하시겠습니까?')) { await updateDoc(doc(db, 'tabs', activeTabId), { links: activeTab.links.filter(item => item !== l) }); toast.success('삭제되었습니다.'); } }} onSave={async () => { const validatedUrl = formatAndValidateUrl(editLinkUrl); if (!validatedUrl) return toast.error('올바른 웹사이트 주소를 입력해주세요!'); const newLinks = [...activeTab.links]; newLinks[idx] = { title: editLinkTitle, url: validatedUrl }; await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks }); setEditingLinkIndex(null); toast.success('성공적으로 수정되었습니다.'); }} onCancel={() => setEditingLinkIndex(null)} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              {/* 🚀 단일 링크 추가 및 엑셀 대량 추가 토글 영역 */}
              <div style={{ marginTop: '20px', background: '#eee', padding: '15px', borderRadius: '8px' }}>
                
                {/* 일반 1개 추가 폼 */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: showBulkAdd ? '15px' : '0' }}>
                  <input type="text" placeholder="제목" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '8px', minWidth: '100px' }} />
                  <input type="text" placeholder="URL (google.com만 쳐도 됨)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} style={{ flex: 2, padding: '8px', minWidth: '150px' }} />
                  <button onClick={handleAddLink} style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '8px 15px', whiteSpace: 'nowrap', borderRadius: '4px', cursor: 'pointer' }}>추가</button>
                  
                  {/* 대량 추가 토글 버튼 */}
                  <button 
                    onClick={() => setShowBulkAdd(!showBulkAdd)} 
                    style={{ background: showBulkAdd ? '#5f6368' : '#e8f0fe', color: showBulkAdd ? 'white' : '#1a73e8', border: '1px solid #1a73e8', padding: '8px 15px', whiteSpace: 'nowrap', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {showBulkAdd ? '닫기' : '대량 추가 (엑셀 복붙)'}
                  </button>
                </div>

                {/* 📋 엑셀 복붙 대량 추가 폼 (토글 시에만 보임) */}
                {showBulkAdd && (
                  <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#555' }}>
                      💡 <b>사용 방법:</b> 엑셀이나 스프레드시트에서 <b>[A열: 제목, B열: URL 주소]</b>를 드래그해서 복사(`Ctrl+C`)한 뒤, 아래 칸에 그대로 붙여넣기(`Ctrl+V`) 해주세요. 여러 개가 한 번에 추가됩니다!
                    </p>
                    <textarea 
                      placeholder="여기에 복사한 데이터를 붙여넣으세요..."
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      style={{ width: '100%', height: '120px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '10px', resize: 'vertical' }}
                    />
                    <button onClick={handleBulkAdd} style={{ width: '100%', background: '#4caf50', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                      싹 다 추가하기
                    </button>
                  </div>
                )}
                
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
            <input type="text" placeholder="탭 이름 입력" value={newTabName} onChange={e => setNewTabName(e.target.value)} autoFocus onKeyDown={(e) => { if(e.key === 'Enter') handleAddTab(); }} />
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