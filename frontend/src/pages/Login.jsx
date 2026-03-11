import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid username or password.');
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (role) => {
        const creds = {
            admin: { username: 'admin', password: 'admin123' },
            student: { username: 'nithin2025', password: 'student123' },
            parent: { username: 'parent.nithin', password: 'parent123' },
        };
        setUsername(creds[role].username);
        setPassword(creds[role].password);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', width: '900px', maxWidth: '95vw', minHeight: '520px', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                {/* Left panel */}
                <div style={{
                    width: '45%',
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2))',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '48px 36px',
                    borderRight: '1px solid var(--glass-border)',
                    backdropFilter: 'blur(16px)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GraduationCap size={24} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, fontFamily: 'Outfit' }} className="gradient-text">Academic Navigator</h1>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Version 4.0</p>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px', lineHeight: 1.2 }}>Your Academic Universe, Unified.</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7, marginBottom: '32px' }}>
                        Real-time attendance, AI-powered timetables, performance analytics, and fee management — all in one Glassmorphic dashboard.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Login (Demo)</p>
                        {[['admin', 'Admin / Faculty'], ['student', 'Student'], ['parent', 'Parent']].map(([role, label]) => (
                            <button key={role} onClick={() => fillDemo(role)} className="btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '13px' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: role === 'admin' ? '#7c3aed' : role === 'student' ? '#06b6d4' : '#10b981', display: 'inline-block' }} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ flex: 1, background: 'var(--navy-card)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px' }}>
                    <h2 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>Sign In</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Enter your credentials to access your dashboard</p>

                    {error && (
                        <div className="alert-banner alert-danger" style={{ marginBottom: '20px' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Username</label>
                            <input className="an-input" type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input className="an-input" type={showPass ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '44px' }} />
                                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px', justifyContent: 'center', padding: '13px' }}>
                            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Signing In...</> : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
