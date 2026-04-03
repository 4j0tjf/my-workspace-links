import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UserPage from './UserPage';
import AdminPage from './AdminPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;