import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

function MemoApp() {
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');

  // 파이어베이스에서 메모 불러오기
  useEffect(() => {
    const q = query(collection(db, 'memos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMemos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 메모 저장
  const handleAddMemo = async () => {
    if (!newMemo.trim()) return;
    await addDoc(collection(db, 'memos'), {
      text: newMemo,
      createdAt: serverTimestamp()
    });
    setNewMemo('');
  };

  // 메모 삭제
  const handleDeleteMemo = async (id) => {
    if (window.confirm('이 메모를 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'memos', id));
    }
  };

  return (
    <div className="container">
      <h2 className="title">📝 메모장</h2>
      
      <div style={{ marginBottom: '30px' }}>
        <textarea 
          placeholder="오늘의 아이디어나 할 일을 메모해 보세요..."
          value={newMemo}
          onChange={(e) => setNewMemo(e.target.value)}
          style={{ 
            width: '100%', height: '100px', padding: '15px', borderRadius: '10px', 
            border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', 
            color: 'var(--text-color)', fontSize: '15px', boxSizing: 'border-box',
            resize: 'vertical', outline: 'none', marginBottom: '10px'
          }}
        />
        <button 
          onClick={handleAddMemo}
          style={{ 
            background: 'var(--tab-active)', color: 'white', border: 'none', 
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          저장하기
        </button>
      </div>

      {/* 저장된 메모 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {memos.map(memo => (
          <div key={memo.id} style={{ 
            backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', 
            padding: '20px', borderRadius: '10px', position: 'relative' 
          }}>
            <p style={{ margin: '0 0 10px 0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{memo.text}</p>
            
            <button 
              onClick={() => handleDeleteMemo(memo.id)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: '#d32f2f', cursor: 'pointer' }}
              title="삭제"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MemoApp;