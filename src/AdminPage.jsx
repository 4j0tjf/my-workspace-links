import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* --- 🌐 URL 검증 및 자동 포맷팅 함수 --- */
const formatAndValidateUrl = (url) => {
  let formattedUrl = url.trim();
  
  // 1. http:// 또는 https:// 로 시작하지 않으면 https:// 를 자동으로 붙임
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }
  
  // 2. 내장된 URL 객체를 활용해 실제 유효한 주소인지 검증
  try {
    new URL(formattedUrl);
    return formattedUrl; // 유효하면 포맷팅된 URL 반환
  } catch (error) {
    return null; // 유효하지 않으면 null 반환
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

  const handleAddTab = async () => {
    const trimmedName = newTabName.trim();
    if (!trimmedName) return alert('탭 이름을 입력해주세요.');
    const isDuplicate = tabs.some(tab => tab.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (isDuplicate) {
      alert(`'${trimmedName}'은(는) 이미 존재하는 탭 이름입니다. 다른 이름을 사용해주세요.`);
      return;
    }

    try {
      await addDoc(collection(db, 'tabs'), { name: trimmedName, links: [], order: tabs.length, createdAt: serverTimestamp() });
      setNewTabName('');
      setIsModalOpen(false);
    } catch (error) { alert('탭 추가 오류'); }
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

  /* --- 🚀 링크 추가 로직 (URL 검증 포함) --- */
  const handleAddLink = async () => {
    if (!newLinkTitle || !newLinkUrl) return;

    const validatedUrl = formatAndValidateUrl(newLinkUrl);
    if (!validatedUrl) {
      alert('올바른 웹사이트 주소를 입력해주세요!\n(예: google.com 또는 https://google.com)');
      return;
    }

    const currentTab = tabs.find(t => t.id === activeTabId);
    await updateDoc(doc(db, 'tabs', activeTabId), { links: [...(currentTab.links || []), { title: newLinkTitle, url: validatedUrl }] });
    setNewLinkTitle(''); setNewLinkUrl('');
  };

  const searchResults = tabs.flatMap(tab => 
    (tab.links || []).map((link, index) => ({ tab, link, index }))
      .filter(({ link }) => link.title.toLowerCase().includes(searchQuery.toLowerCase()) || link.url.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h2>로그인</h2>
        <form onSubmit={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); setIsLoggedIn(true); } catch(err) { alert('실패'); } }} style={{ display: 'inline-flex', flexDirection: 'column', gap: '10px' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>⚙️ 어드민 도구</h2>
        <button onClick={() => signOut(auth)}>로그아웃</button>
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
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ width: '100%', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold' }}
          >
            + 새 탭 만들기
          </button>

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
                        onDelete={async (l) => { if(confirm('삭제?')) await updateDoc(doc(db, 'tabs', activeTabId), { links: activeTab.links.filter(item => item !== l) }); }} 
                        /* --- 🚀 링크 수정 로직 (URL 검증 포함) --- */
                        onSave={async () => { 
                          const validatedUrl = formatAndValidateUrl(editLinkUrl);
                          if (!validatedUrl) {
                            alert('올바른 웹사이트 주소를 입력해주세요!');
                            return;
                          }
                          const newLinks = [...activeTab.links]; 
                          newLinks[idx] = { title: editLinkTitle, url: validatedUrl }; 
                          await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks }); 
                          setEditingLinkIndex(null); 
                        }} 
                        onCancel={() => setEditingLinkIndex(null)} 
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              <div style={{ display: 'flex', gap: '5px', marginTop: '20px', background: '#eee', padding: '15px', borderRadius: '8px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="제목" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '8px', minWidth: '100px' }} />
                <input type="text" placeholder="URL (google.com만 쳐도 됨)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} style={{ flex: 2, padding: '8px', minWidth: '150px' }}