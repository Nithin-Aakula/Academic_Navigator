import { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ClassModeWebcam from '../components/ClassModeWebcam';
import api from '../api/client';
import {
    LayoutDashboard, BarChart2, Calendar, MessageSquare, AlertTriangle,
    UserCircle, CheckSquare, Search, ClipboardList, Clock, CreditCard,
    BookOpen, CalendarDays
} from 'lucide-react';
import {
    RadialBarChart, RadialBar, PolarAngleAxis,
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';

const navItems = [
    { to: '/student', icon: LayoutDashboard, label: 'Overview' },
    { to: '/student/profile', icon: UserCircle, label: 'Profile & Bio-data' },
    { to: '/student/calendar', icon: Calendar, label: 'Academic Calendar' },
    { to: '/student/attendance', icon: CheckSquare, label: 'Detailed Attendance' },
    { to: '/student/backlogs', icon: AlertTriangle, label: 'Backlogs' },
    { to: '/student/book-search', icon: Search, label: 'Book Search' },
    { to: '/student/assignments', icon: ClipboardList, label: 'Class Assignments' },
    { to: '/student/complaints', icon: MessageSquare, label: 'Complaint / Suggestion' },
    { to: '/student/exams', icon: Clock, label: 'Exam Schedule' },
    { to: '/student/fees', icon: CreditCard, label: 'Fee Details & Dues' },
    { to: '/student/library', icon: BookOpen, label: 'Library Books' },
    { to: '/student/marks', icon: BarChart2, label: 'Marks & Performance' },
    { to: '/student/timetable', icon: CalendarDays, label: 'Time Table' },
];

function AttendanceDonut({ percentage, label }) {
    const color = percentage >= 75 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#f43f5e';
    return (
        <div style={{ textAlign: 'center' }}>
            <RadialBarChart width={120} height={120} cx={60} cy={60} innerRadius={40} outerRadius={55} data={[{ value: percentage, fill: color }]} startAngle={90} endAngle={90 - 360 * percentage / 100}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={10} />
            </RadialBarChart>
            <p style={{ fontSize: '20px', fontWeight: 800, margin: '-30px 0 0', fontFamily: 'Outfit', color }}>{percentage}%</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '28px 0 0' }}>{label}</p>
        </div>
    );
}

function StudentHome() {
    const [summary, setSummary] = useState([]);
    const [marks, setMarks] = useState([]);
    const [backlogs, setBacklogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/attendance/summary/'),
            api.get('/marks/'),
            api.get('/backlogs/'),
        ]).then(([attRes, marksRes, backRes]) => {
            setSummary(attRes.data);
            setMarks(marksRes.data.results || marksRes.data);
            setBacklogs(backRes.data.results || backRes.data);
        }).catch(() => { }).finally(() => setLoading(false));
    }, []);

    const overallAtt = summary.length ? (summary.reduce((s, a) => s + a.percentage, 0) / summary.length).toFixed(1) : 0;
    const lineData = marks.map(m => ({ name: m.subject_code, Internal: m.internal, External: m.external, Total: m.total }));

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px', fontFamily: 'Outfit' }}>My Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Semester 4 — Computer Science</p>

            {Number(overallAtt) < 75 && (
                <div className="alert-banner alert-danger" style={{ marginBottom: '24px' }}>
                    <AlertTriangle size={18} />
                    <span><strong>Attendance Alert:</strong> Your overall attendance is {overallAtt}% — below the 75% threshold! Contact your faculty immediately.</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="premium-card">
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>Marks Progress</h3>
                    {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div> : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={lineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Line type="monotone" dataKey="Internal" stroke="var(--accent-purple)" strokeWidth={2} dot={{ fill: 'var(--accent-purple)', r: 4 }} />
                                <Line type="monotone" dataKey="External" stroke="var(--accent-blue)" strokeWidth={2} dot={{ fill: 'var(--accent-blue)', r: 4 }} />
                                <Line type="monotone" dataKey="Total" stroke="var(--accent-emerald)" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: 'var(--accent-emerald)', r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="premium-card">
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>Pending Backlogs</h3>
                    {loading ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div> : (
                        backlogs.filter(b => !b.cleared).length === 0
                            ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--accent-emerald)' }}>🎉 No backlogs!</div>
                            : backlogs.filter(b => !b.cleared).map(b => (
                                <div key={b.id} style={{ padding: '12px', background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.1)', borderRadius: '8px', marginBottom: '8px' }}>
                                    <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: 'var(--accent-rose)' }}>{b.subject_name}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Exam: {b.exam_date || 'TBA'}</p>
                                </div>
                            ))
                    )}
                </div>
            </div>

            <div className="premium-card">
                <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>Subject-wise Attendance</h3>
                {loading ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                        {summary.map(s => (
                            <div key={s.subject_code} style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-elevated)', border: `1px solid var(--border-subtle)`, borderRadius: '12px' }}>
                                <AttendanceDonut percentage={s.percentage} label={s.subject_code} />
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>{s.attended}/{s.total_classes} classes</p>
                                <span className={`badge badge-${s.status}`} style={{ marginTop: '8px' }}>{s.status.toUpperCase()}</span>
                            </div>
                        ))}
                        {!summary.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No attendance data yet.</div>}
                    </div>
                )}
            </div>
        </div>
    );
}

function MarksPage() {
    const [marks, setMarks] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/marks/').then(r => setMarks(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);
    const gradeColor = (g) => ({ O: '#34d399', 'A+': '#22d3ee', A: '#7c3aed', 'B+': '#f59e0b', B: '#fb923c', C: '#f43f5e', F: '#dc2626' }[g] || '#94a3b8');
    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>My Marks</h1>
            <div className="premium-table-container">
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Subject</th><th>Internal (40)</th><th>External (60)</th><th>Total (100)</th><th>Grade</th></tr></thead>
                        <tbody>
                            {marks.map(m => (
                                <tr key={m.id}>
                                    <td><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.subject_name}</span><br /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.subject_code}</span></td>
                                    <td>{m.internal}</td>
                                    <td>{m.external}</td>
                                    <td style={{ fontWeight: 600, color: m.total >= 75 ? 'var(--accent-emerald)' : m.total >= 50 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>{m.total}</td>
                                    <td><span className={`badge ${['O', 'A+', 'A'].includes(m.grade) ? 'badge-success' : ['B+', 'B'].includes(m.grade) ? 'badge-warning' : 'badge-error'}`}>{m.grade}</span></td>
                                </tr>
                            ))}
                            {!marks.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No marks available.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function ComplaintsPage() {
    const [dept, setDept] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            await api.post('/complaints/', { target_hod_department: dept, body });
            setSent(true);
            setDept(''); setBody('');
            setTimeout(() => setSent(false), 3000);
        } catch { alert('Failed to send complaint.'); }
        finally { setSending(false); }
    };
    return (
        <div style={{ maxWidth: '600px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Anonymous Complaints</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>Your identity is not stored with this complaint.</p>
            {sent && <div className="alert-banner alert-success" style={{ marginBottom: '20px' }}>✓ Complaint submitted anonymously.</div>}
            <form onSubmit={handleSubmit} className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 500 }}>Target Department / HoD</label>
                    <input className="premium-input" placeholder="e.g. Computer Science" value={dept} onChange={e => setDept(e.target.value)} required />
                </div>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 500 }}>Your Complaint</label>
                    <textarea className="premium-input" rows={6} placeholder="Describe your concern in detail…" value={body} onChange={e => setBody(e.target.value)} required style={{ resize: 'vertical' }} />
                </div>
                <button className="btn-primary" type="submit" disabled={sending} style={{ alignSelf: 'flex-start' }}>
                    {sending ? 'Sending…' : 'Submit Anonymously'}
                </button>
            </form>
        </div>
    );
}

export default function StudentDashboard() {
    return (
        <div className="app-container">
            <Sidebar navItems={navItems} />
            <main className="main-content">
                <Routes>
                    <Route index element={<StudentHome />} />
                    <Route path="marks" element={<MarksPage />} />
                    <Route path="attendance" element={<AttendanceDetailPage />} />
                    <Route path="complaints" element={<ComplaintsPage />} />
                    <Route path="*" element={<div className="premium-card"><h2>Coming Soon</h2><p style={{ color: 'var(--text-secondary)' }}>This module is currently under development.</p></div>} />
                </Routes>
            </main>
        </div>
    );
}

function AttendanceDetailPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/attendance/').then(r => setLogs(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);
    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Attendance Log</h1>
            <div className="premium-table-container">
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Marked By</th></tr></thead>
                        <tbody>
                            {logs.map(l => (
                                <tr key={l.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{l.date}</td>
                                    <td><span style={{ fontWeight: 500 }}>{l.subject_code}</span></td>
                                    <td><span className={`badge ${l.status === 'present' ? 'badge-success' : l.status === 'late' ? 'badge-warning' : 'badge-error'}`}>{l.status.toUpperCase()}</span></td>
                                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.marked_by_fr ? '🤖 Facial Recognition' : '✍️ Manual'}</td>
                                </tr>
                            ))}
                            {!logs.length && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No attendance records yet.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
