import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

// DND 관련 컴포넌트들
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* --- 1. 드래그 가능한 탭 아이템 컴포넌트 --- */
function SortableTabItem({ id, tab, activeTabId, setActiveTabId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: activeTabId === tab.id ? 'bold' : 'normal',
    color: activeTabId === tab.id ? '#d32f2f' : '#5f6368',
    borderBottom: activeTabId === tab.id ? '3px solid #d32f2f' : '3px solid transparent',
    backgroundColor: isDragging ? '#f0f0f0' : 'transparent',
    zIndex: isDragging ? 100 : 'auto',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => setActiveTabId(tab.id)} {...attributes} {...listeners}>
      ☰ {tab.name}
    </div>
  );
}

/* --- 2. 드래그 가능한 링크 아이템 컴포넌트 --- */
function SortableLinkItem({ id, link, idx, onEdit, onDelete, editingIndex, editTitle, setEditTitle, editUrl, setEditUrl, onSave, onCancel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: '#fff',
    border: '1px solid #eee',
    marginBottom: '8px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    gap: '10px'
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
  const [newTabName, setNewTabName] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState(null);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');

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

  /* --- 탭 순서 변경 처리 --- */
  const handleTabDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tabs.findIndex(t => t.id === active.id);
    const newIndex = tabs.findIndex(t => t.id === over.id);
    const newTabs = arrayMove(tabs, oldIndex, newIndex);

    // DB에 일괄 업데이트 (Batch)
    const batch = writeBatch(db);
    newTabs.forEach((tab, index) => {
      const tabRef = doc(db, 'tabs', tab.id);
      batch.update(tabRef, { order: index });
    });
    await batch.commit();
  };

  /* --- 링크 순서 변경 처리 --- */
  const handleLinkDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentTab = tabs.find(t => t.id === activeTabId);
    const oldIndex = parseInt(active.id.split('-')[1]);
    const newIndex = parseInt(over.id.split('-')[1]);
    const newLinks = arrayMove(currentTab.links, oldIndex, newIndex);

    await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks });
  };

  /* --- 기타 관리 함수들 --- */
  const handleAddTab = async () => {
    if (!newTabName.trim()) return;
    await addDoc(collection(db, 'tabs'), { name: newTabName, links: [], order: tabs.length, createdAt: serverTimestamp() });
    setNewTabName('');
  };

  const handleAddLink = async () => {
    if (!newLinkTitle || !newLinkUrl) return;
    const currentTab = tabs.find(t => t.id === activeTabId);
    await updateDoc(doc(db, 'tabs', activeTabId), { links: [...(currentTab.links || []), { title: newLinkTitle, url: newLinkUrl }] });
    setNewLinkTitle(''); setNewLinkUrl('');
  };

  if (!isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h2>로그인</h2>
        <form onSubmit={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); setIsLoggedIn(true); } catch(err) { alert('로그인 실패'); } }}>
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '10px', marginBottom: '5px' }} /><br/>
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px', marginBottom: '10px' }} /><br/>
          <button type="submit" style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none' }}>로그인</button>
        </form>
      </div>
    );
  }

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>⚙️ 전체 관리 (탭/링크 드래그 가능)</h2>
        <button onClick={() => signOut(auth)}>로그아웃</button>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
        <input type="text" placeholder="새 탭 이름" value={newTabName} onChange={e => setNewTabName(e.target.value)} style={{ flex: 1, padding: '10px' }} />
        <button onClick={handleAddTab} style={{ padding: '10px 20px' }}>탭 추가</button>
      </div>

      {/* --- 탭 드래그 영역 --- */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
        <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid #eee', marginBottom: '20px' }}>
            {tabs.map(tab => (
              <SortableTabItem key={tab.id} id={tab.id} tab={tab} activeTabId={activeTabId} setActiveTabId={setActiveTabId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* --- 링크 드래그 영역 --- */}
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
                    onSave={async () => {
                      const newLinks = [...activeTab.links];
                      newLinks[idx] = { title: editLinkTitle, url: editLinkUrl };
                      await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks });
                      setEditingLinkIndex(null);
                    }}
                    onCancel={() => setEditingLinkIndex(null)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div style={{ display: 'flex', gap: '5px', marginTop: '20px', background: '#eee', padding: '15px', borderRadius: '8px' }}>
            <input type="text" placeholder="링크명" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '8px' }} />
            <input type="text" placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} style={{ flex: 2, padding: '8px' }} />
            <button onClick={handleAddLink} style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '8px 15px' }}>추가</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;