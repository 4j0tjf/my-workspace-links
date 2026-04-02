import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserPage from './UserPage';
import AdminPage from './AdminPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 기본 주소(/)로 접속하면 UserPage를 보여줌 */}
        <Route path="/" element={<UserPage />} />
        
        {/* /admin 주소로 접속하면 AdminPage를 보여줌 */}
        <Route path="/admin" element={<AdminPage />} />
        
        {/* 그 외의 이상한 주소로 접속하면 기본 주소(/)로 튕겨냄 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;