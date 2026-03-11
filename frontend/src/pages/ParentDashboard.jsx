import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/client';
import { LayoutDashboard, DollarSign, TrendingUp, Bell, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const navItems = [
    { to: '/parent', icon: LayoutDashboard, label: 'Overview' },
    { to: '/parent/fees', icon: DollarSign, label: 'Fee Status' },
    { to: '/parent/performance', icon: TrendingUp, label: 'Performance' },
];

function ParentHome() {
    const [summary, setSummary] = useState([]);
    const [fees, setFees] = useState([]);
    const [recent, setRecent] = useState([]);
    const [notification, setNotification] = useState(null);
    const prevRecentRef = useRef([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [attRes, feeRes, recRes] = await Promise.all([
                api.get('/attendance/summary/'),
                api.get('/fees/'),
                api.get('/attendance/recent/'),
            ]);
            setSummary(attRes.data);
            setFees(feeRes.data.results || feeRes.data);
            const newRecent = recRes.data.results || recRes.data;
            // Detect new attendance records
            if (prevRecentRef.current.length > 0 && newRecent.length > 0) {
                const latest = newRecent[0];
                const prevLatest = prevRecentRef.current[0];
                if (latest?.id !== prevLatest?.id) {
                    setNotification({ type: 'info', msg: `📍 Attendance updated: ${latest.subject_code} — ${latest.status.toUpperCase()} on ${latest.date}` });
                    setTimeout(() => setNotification(null), 6000);
                }
            }
            prevRecentRef.current = newRecent;
            setRecent(newRecent);
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // poll every 30s
        return () => clearInterval(interval);
    }, []);

    const totalDue = fees.reduce((s, f) => s + Number(f.amount_due || 0), 0);
    const totalPaid = fees.reduce((s, f) => s + Number(f.amount_paid || 0), 0);
    const balance = totalDue - totalPaid;
    const overallAtt = summary.length ? (summary.reduce((s, a) => s + a.percentage, 0) / summary.length).toFixed(1) : 0;
    const attColor = Number(overallAtt) >= 75 ? '#10b981' : Number(overallAtt) >= 60 ? '#f59e0b' : '#f43f5e';

    const pieData = [
        { name: 'Present', value: summary.reduce((s, a) => s + a.attended, 0) },
        { name: 'Absent', value: summary.reduce((s, a) => s + (a.total_classes - a.attended), 0) },
    ];
    const PIE_COLORS = ['#10b981', '#f43f5e'];

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px', fontFamily: 'Outfit' }}>Parent Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Real-time updates for your ward · <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Auto-refresh every 30s</span>
            </p>

            {notification && (
                <div className="alert-banner alert-warning" style={{ marginBottom: '20px' }}>
                    <Bell size={16} /> {notification.msg}
                </div>
            )}

            {Number(overallAtt) < 75 && (
                <div className="alert-banner alert-danger" style={{ marginBottom: '20px' }}>
                    <AlertTriangle size={16} />
                    <strong>Low Attendance Alert:</strong>&nbsp;Overall attendance is {overallAtt}% — below 75% threshold!
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="kpi-card" style={{ borderColor: `${attColor}33` }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Overall Attendance</p>
                    <p style={{ fontSize: '48px', fontWeight: 800, fontFamily: 'Outfit', color: attColor, margin: 0 }}>{loading ? '…' : `${overallAtt}%`}</p>
                    <span className={`badge badge-${Number(overallAtt) >= 75 ? 'safe' : Number(overallAtt) >= 60 ? 'warning' : 'critical'}`} style={{ marginTop: '8px' }}>
                        {Number(overallAtt) >= 75 ? 'On Track' : Number(overallAtt) >= 60 ? 'Warning' : 'Critical'}
                    </span>
                </div>
                <div className="kpi-card">
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Fee Balance</p>
                    <p style={{ fontSize: '36px', fontWeight: 800, fontFamily: 'Outfit', color: balance > 0 ? '#f43f5e' : '#10b981', margin: 0 }}>₹{loading ? '…' : balance.toLocaleString()}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>of ₹{totalDue.toLocaleString()} total due</p>
                </div>
                <div className="kpi-card">
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Subjects at Risk</p>
                    <p style={{ fontSize: '48px', fontWeight: 800, fontFamily: 'Outfit', color: '#f43f5e', margin: 0 }}>
                        {loading ? '…' : summary.filter(s => s.status !== 'safe').length}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>below 75% attendance</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div className="premium-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700 }}>Attendance Distribution</h3>
                    <PieChart width={240} height={200} style={{ margin: '0 auto' }}>
                        <Pie data={pieData} cx={120} cy={90} innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#181b2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f1f5f9' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    </PieChart>
                </div>

                <div className="premium-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Recent Attendance Activity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {loading ? <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</div> :
                            recent.slice(0, 8).map(r => (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {r.status === 'present' ? <CheckCircle size={14} color="#10b981" /> : <AlertTriangle size={14} color="#f43f5e" />}
                                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{r.subject_code}</span>
                                        {r.marked_by_fr && <span style={{ fontSize: '10px', background: 'rgba(124,58,237,0.2)', color: '#8b5cf6', padding: '1px 6px', borderRadius: '10px' }}>FR</span>}
                                    </div>
                                    <div style={{ display: 'flex', align: 'center', gap: '8px' }}>
                                        <span className={`badge badge-${r.status === 'present' ? 'safe' : 'critical'}`}>{r.status}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} />{r.date}</span>
                                    </div>
                                </div>
                            ))
                        }
                        {!loading && !recent.length && <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No recent activity.</div>}
                    </div>
                </div>
            </div>

            <div className="premium-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Subject-wise Attendance</h3>
                {loading ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Subject</th><th>Attended</th><th>Total</th><th>%</th><th>Status</th></tr></thead>
                        <tbody>
                            {summary.map(s => (
                                <tr key={s.subject_code}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.subject_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>({s.subject_code})</span></td>
                                    <td>{s.attended}</td>
                                    <td>{s.total_classes}</td>
                                    <td style={{ fontWeight: 700, color: s.status === 'safe' ? '#34d399' : s.status === 'warning' ? '#fbbf24' : '#fb7185' }}>{s.percentage}%</td>
                                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                                </tr>
                            ))}
                            {!summary.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No data available.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default function ParentDashboard() {
    return (
        <div className="app-container">
            <Sidebar navItems={navItems} />
            <main className="main-content">
                <Routes>
                    <Route index element={<ParentHome />} />
                    <Route path="fees" element={<ParentFeesPage />} />
                    <Route path="performance" element={<ParentPerformancePage />} />
                </Routes>
            </main>
        </div>
    );
}

function ParentFeesPage() {
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/fees/').then(r => setFees(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);
    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Fee Status</h1>
            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Semester</th><th>Amount Due</th><th>Paid</th><th>Balance</th><th>Due Date</th><th>Status</th></tr></thead>
                        <tbody>
                            {fees.map(f => (
                                <tr key={f.id}>
                                    <td>Sem {f.semester}</td>
                                    <td>₹{Number(f.amount_due).toLocaleString()}</td>
                                    <td style={{ color: '#34d399' }}>₹{Number(f.amount_paid).toLocaleString()}</td>
                                    <td style={{ color: f.balance > 0 ? '#fb7185' : '#34d399', fontWeight: 700 }}>₹{Number(f.balance).toLocaleString()}</td>
                                    <td>{f.due_date}</td>
                                    <td><span className={`badge badge-${f.status}`}>{f.status}</span></td>
                                </tr>
                            ))}
                            {!fees.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No fee records.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function ParentPerformancePage() {
    const [marks, setMarks] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/marks/').then(r => setMarks(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);
    const lineData = marks.map(m => ({ name: m.subject_code, Internal: m.internal, External: m.external, Total: m.total }));
    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Academic Performance</h1>
            <div className="premium-card" style={{ padding: '28px' }}>
                <h3 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 700 }}>Marks by Subject</h3>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={lineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#181b2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f1f5f9' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Line type="monotone" dataKey="Internal" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} />
                            <Line type="monotone" dataKey="External" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
                            <Line type="monotone" dataKey="Total" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
