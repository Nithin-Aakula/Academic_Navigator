import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, LogOut } from 'lucide-react';

export default function Sidebar({ navItems }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={20} color="white" />
                </div>
                <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Academic Nav</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize', margin: 0 }}>{user?.role}</p>
                </div>
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{user?.first_name} {user?.last_name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{user?.email}</p>
            </div>

            <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={handleLogout} className="nav-item" style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--accent-rose)', justifyContent: 'flex-start' }}>
                    <LogOut size={18} />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
