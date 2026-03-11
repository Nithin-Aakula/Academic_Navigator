import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ParentDashboard from './pages/ParentDashboard';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function RoleRouter() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
  if (user.role === 'student') return <Navigate to="/student" replace />;
  if (user.role === 'parent') return <Navigate to="/parent" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="bg-blobs">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleRouter />} />
          <Route path="/admin/*" element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/faculty/*" element={
            <ProtectedRoute roles={['admin', 'faculty']}>
              <FacultyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student/*" element={
            <ProtectedRoute roles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/parent/*" element={
            <ProtectedRoute roles={['parent']}>
              <ParentDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
