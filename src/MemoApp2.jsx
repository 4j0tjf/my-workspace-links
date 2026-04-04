import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

function MemoApp() {
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'memos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMemos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddMemo = async () => {
    if (!newMemo.trim()) return;
    await addDoc(collection(db, 'memos'), { text: newMemo, createdAt: serverTimestamp() });
    setNewMemo('');
  };

  const handleDeleteMemo = async (id) => {
    if (window.confirm('이 메모를 삭제하시겠습니까?')) await deleteDoc(doc(db, 'memos', id));
  };

  return (
    <div className="container">
      <h2 className="title">메모장</h2>
      
      {/* --- 메모 입력 영역 --- */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <textarea 
            placeholder="오늘의 아이디어나 할 일을 메모해 보세요..." 
            value={newMemo} 
            onChange={(e) => setNewMemo(e.target.value)}
            style={{ 
              width: '100%', 
              height: '120px', 
              padding: '15px 15px 35px 15px', /* 글자수 카운터와 겹치지 않게 하단 여백(35px) 확보 */
              borderRadius: '10px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--card-bg)', 
              color: 'var(--text-color)', 
              fontSize: '15px', 
              boxSizing: 'border-box', 
              resize: 'vertical', 
              outline: 'none' 
            }}
          />
          {/* ✨ 1. 입력 중인 실시간 글자 수 (우측 하단) */}
          <div style={{ 
            position: 'absolute', 
            bottom: '12px', 
            right: '15px', 
            fontSize: '12px', 
            color: 'var(--tab-inactive)',
            fontWeight: 'bold'
          }}>
            {newMemo.length} 자
          </div>
        </div>
        <button onClick={handleAddMemo} style={{ background: 'var(--tab-active)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          저장하기
        </button>
      </div>

      {/* --- 저장된 메모 목록 --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {memos.map(memo => (
          /* ✨ 3. 박스와 삭제 버튼을 분리하기 위해 flex로 감쌈 */
          <div key={memo.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            
            {/* 메모 내용 박스 */}
            <div style={{ 
              flex: 1, 
              backgroundColor: 'var(--card-bg)', 
              border: '1px solid var(--border-color)', 
              padding: '20px 20px 35px 20px', /* 하단 여백 추가 */
              borderRadius: '10px', 
              position: 'relative' 
            }}>
              <p style={{ margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{memo.text}</p>
              
              {/* ✨ 2. 저장된 메모 글자 수 (우측 하단) */}
              <div style={{ 
                position: 'absolute', 
                bottom: '10px', 
                right: '15px', 
                fontSize: '12px', 
                color: 'var(--tab-inactive)' 
              }}>
                {memo.text?.length || 0} 자
              </div>
            </div>

            {/* ✨ 3. 삭제 버튼 (박스 외부 우측으로 완전 분리) */}
            <button 
              onClick={() => handleDeleteMemo(memo.id)} 
              style={{ 
                background: 'transparent', 
                border: '1px solid transparent', 
                color: '#d32f2f', 
                cursor: 'pointer', 
                padding: '12px', 
                flexShrink: 0,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="삭제"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

export default MemoApp;