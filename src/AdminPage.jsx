import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

// DND 관련 컴포넌트들
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* --- 드래그 가능한 아이템 컴포넌트 (링크용) --- */
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
    gap: '10px',
    zIndex: isDragging ? 100 : 'auto'
  };

  return (
    <li ref={setNodeRef} style={style}>
      {/* ✋ 핸들러: 여기를 잡고 끌어야 함 */}
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#ccc', fontSize: '20px' }}>⠿</div>
      
      <div style={{ flex: 1 }}>
        {editingIndex === idx ? (
          <div style={{ display: 'flex', gap: '5px', width: '100%', flexWrap: 'wrap' }}>
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ flex: 1, padding: '5px' }} />
            <input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} style={{ flex: 2, padding: '5px' }} />
            <button onClick={onSave} style={{ padding: '5px 10px', background: '#1a73e8', color: 'white', border: 'none' }}>저장</button>
            <button onClick={onCancel} style={{ padding: '5px 10px' }}>취소</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ wordBreak: 'break-all' }}>
              <strong>{link.title}</strong> <br/>
              <span style={{ color: 'gray', fontSize: '12px' }}>{link.url}</span>
            </div>
            <div>
              <button onClick={() => onEdit(idx, link)} style={{ marginRight: '5px', padding: '5px' }}>✏️</button>
              <button onClick={() => onDelete(link)} style={{ padding: '5px' }}>🗑️</button>
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

  // DND 센서 설정 (마우스, 터치, 키보드 지원)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!isLoggedIn) return;
    // 'order' 필드 기준으로 정렬해서 가져오기
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

  /* --- 탭 및 링크 관리 로직 --- */
  const handleAddTab = async () => {
    if (!newTabName.trim()) return;
    await addDoc(collection(db, 'tabs'), { 
      name: newTabName, 
      links: [], 
      order: tabs.length, // 마지막 순서로 배치
      createdAt: serverTimestamp() 
    });
    setNewTabName('');
  };

  const handleAddLink = async () => {
    if (!newLinkTitle || !newLinkUrl) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    const updatedLinks = [...(activeTab.links || []), { title: newLinkTitle, url: newLinkUrl }];
    await updateDoc(doc(db, 'tabs', activeTabId), { links: updatedLinks });
    setNewLinkTitle(''); setNewLinkUrl('');
  };

  const handleDeleteLink = async (linkObj) => {
    if (!window.confirm('삭제할까요?')) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    const updatedLinks = activeTab.links.filter(l => l !== linkObj);
    await updateDoc(doc(db, 'tabs', activeTabId), { links: updatedLinks });
  };

  /* --- 🚀 드래그 앤 드롭 종료 시 처리 (순서 저장) --- */
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTab = tabs.find(t => t.id === activeTabId);
    const oldIndex = activeTab.links.findIndex((_, idx) => `link-${idx}` === active.id);
    const newIndex = activeTab.links.findIndex((_, idx) => `link-${idx}` === over.id);

    // 1. 화면 상태를 먼저 업데이트 (즉각적인 반응)
    const newLinks = arrayMove(activeTab.links, oldIndex, newIndex);
    
    // 2. 파이어베이스에 업데이트
    await updateDoc(doc(db, 'tabs', activeTabId), { links: newLinks });
  };

  if (!isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h2>로그인</h2>
        <form onSubmit={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); setIsLoggedIn(true); } catch(err) { alert('실패'); } }} style={{ display: 'inline-flex', flexDirection: 'column', gap: '10px' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '10px' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px' }} />
          <button type="submit" style={{ padding: '10px', background: '#d32f2f', color: 'white', border: 'none' }}>로그인</button>
        </form>
      </div>
    );
  }

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>⚙️ 어드민 (순서 변경 가능)</h2>
        <button onClick={() => signOut(auth)}>로그아웃</button>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
        <input type="text" placeholder="새 탭 이름" value={newTabName} onChange={e => setNewTabName(e.target.value)} style={{ flex: 1, padding: '10px' }} />
        <button onClick={handleAddTab}>탭 추가</button>
      </div>

      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid #eee', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <div key={tab.id} onClick={() => setActiveTabId(tab.id)} style={{ padding: '10px 20px', cursor: 'pointer', borderBottom: activeTabId === tab.id ? '3px solid #d32f2f' : '3px solid transparent', color: activeTabId === tab.id ? '#d32f2f' : '#666' }}>
            {tab.name}
          </div>
        ))}
      </div>

      {activeTab && (
        <div>
          {/* 드래그 앤 드롭 컨텍스트 시작 */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeTab.links.map((_, i) => `link-${i}`)} strategy={verticalListSortingStrategy}>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {activeTab.links.map((link, idx) => (
                  <SortableLinkItem 
                    key={`link-${idx}`} 
                    id={`link-${idx}`} 
                    link={link} 
                    idx={idx}
                    editingIndex={editingLinkIndex}
                    editTitle={editLinkTitle}
                    setEditTitle={setEditLinkTitle}
                    editUrl={editLinkUrl}
                    setEditUrl={setEditLinkUrl}
                    onEdit={(i, l) => { setEditingLinkIndex(i); setEditLinkTitle(l.title); setEditLinkUrl(l.url); }}
                    onDelete={handleDeleteLink}
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

          <div style={{ display: 'flex', gap: '5px', marginTop: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
            <input type="text" placeholder="제목" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '8px' }} />
            <input type="text" placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} style={{ flex: 2, padding: '8px' }} />
            <button onClick={handleAddLink} style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px' }}>링크 추가</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;