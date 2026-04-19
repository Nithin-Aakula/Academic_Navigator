import { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TimetableGADashboard from '../components/TimetableGADashboard';
import api from '../api/client';
import {
    LayoutDashboard, Users, BookOpen, Calendar, DollarSign, Library,
    GraduationCap, Zap, Loader2, TrendingUp, AlertTriangle, CheckCircle,
    UserCheck, Plus, Trash2, Pencil, X, Save
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';

const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/faculty', icon: UserCheck, label: 'Faculty' },
    { to: '/admin/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/admin/rooms', icon: LayoutDashboard, label: 'Rooms' },
    { to: '/admin/timeslots', icon: Calendar, label: 'Time Slots' },
    { to: '/admin/timetable', icon: Calendar, label: 'Timetable' },
    { to: '/admin/fees', icon: DollarSign, label: 'Fees' },
    { to: '/admin/library', icon: Library, label: 'Library' },
];

function KPICard({ title, value, sub, color, icon: Icon }) {
    return (
        <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            <p style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{value}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{sub}</p>
        </div>
    );
}

function AdminHome() {
    const [stats, setStats] = useState({ students: 0, subjects: 0, feesPaid: 0, avgAttendance: 0 });
    const [marksData, setMarksData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/students/'),
            api.get('/subjects/'),
            api.get('/fees/?status=paid'),
            api.get('/attendance/summary/?student=1'),
            api.get('/marks/?student=1'),
        ]).then(([stuRes, subRes, feeRes, attRes, marksRes]) => {
            const avgAtt = attRes.data.length
                ? (attRes.data.reduce((s, a) => s + a.percentage, 0) / attRes.data.length).toFixed(1)
                : 0;
            setStats({
                students: stuRes.data.count || stuRes.data.results?.length || stuRes.data.length || 0,
                subjects: subRes.data.count || subRes.data.results?.length || subRes.data.length || 0,
                feesPaid: feeRes.data.count || feeRes.data.results?.length || feeRes.data.length || 0,
                avgAttendance: avgAtt,
            });
            const mArr = (marksRes.data.results || marksRes.data).slice(0, 5);
            setMarksData(mArr.map(m => ({ name: m.subject_code, total: m.total })));
        }).catch(() => { }).finally(() => setLoading(false));
    }, []);

    const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px', fontFamily: 'Outfit' }}>Admin Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Institution-wide overview and controls</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                <KPICard title="Total Students" value={loading ? '...' : stats.students} sub="Enrolled this semester" color="#7c3aed" icon={Users} />
                <KPICard title="Subjects" value={loading ? '...' : stats.subjects} sub="Active this semester" color="#06b6d4" icon={BookOpen} />
                <KPICard title="Conflict Score" value="0" sub="Timetable is conflict-free" color="#10b981" icon={CheckCircle} />
                <KPICard title="Avg Attendance" value={loading ? '...' : `${stats.avgAttendance}%`} sub="All batches combined" color={stats.avgAttendance < 75 ? '#f43f5e' : '#10b981'} icon={TrendingUp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="premium-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700 }}>Marks Overview (Sample Student)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={marksData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#181b2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f1f5f9' }} />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                {marksData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="premium-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                            { label: 'Manage Students', href: '/admin/students', color: '#7c3aed', icon: Users },
                            { label: 'Generate Timetable', href: '/admin/timetable', color: '#06b6d4', icon: Calendar },
                            { label: 'View Fee Records', href: '/admin/fees', color: '#10b981', icon: DollarSign },
                            { label: 'Library Catalog', href: '/admin/library', color: '#f59e0b', icon: Library },
                        ].map(({ label, href, color, icon: Icon }) => (
                            <NavLink key={href} to={href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: `${color}11`, border: `1px solid ${color}33`, textDecoration: 'none', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, transition: 'all 0.2s' }}>
                                <Icon size={16} color={color} />
                                {label}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '', password: '', role: 'student' });
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => { api.get('/students/').then(r => setStudents(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post('/users/', form);
            const r = await api.get('/students/');
            setStudents(r.data.results || r.data);
            setShowForm(false);
            setForm({ username: '', email: '', first_name: '', last_name: '', password: '', role: 'student' });
        } catch (err) {
            const errMsg = err.response?.data ? JSON.stringify(err.response.data).replace(/["{}[\]]/g, ' ') : err.message;
            alert('Error: ' + errMsg);
        }
        finally { setCreating(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Students</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>{students.length} enrolled</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Users size={15} /> {showForm ? 'Cancel' : 'Add Student'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="premium-card" style={{ padding: '24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {[['username', 'Username'], ['email', 'Email'], ['first_name', 'First Name'], ['last_name', 'Last Name'], ['password', 'Password']].map(([field, label]) => (
                        <div key={field}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>{label}</label>
                            <input className="premium-input" type={field === 'password' ? 'password' : 'text'} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} required />
                        </div>
                    ))}
                    <div style={{ gridColumn: '1/-1' }}>
                        <button className="btn-primary" type="submit" disabled={creating}>
                            {creating ? <><Loader2 size={14} /> Creating...</> : 'Create Student User'}
                        </button>
                    </div>
                </form>
            )}

            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Student ID</th><th>Name</th><th>Department</th><th>Semester</th></tr></thead>
                        <tbody>
                            {students.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>{s.student_id}</td>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.user?.first_name} {s.user?.last_name}</td>
                                    <td>{s.department}</td>
                                    <td><span className="badge badge-safe">Sem {s.semester}</span></td>
                                </tr>
                            ))}
                            {!students.length && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No students found.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function FeeAdminPage() {
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/fees/').then(r => setFees(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);
    const paidCount = fees.filter(f => f.status === 'paid').length;
    const unpaidCount = fees.filter(f => f.status === 'unpaid').length;
    const partialCount = fees.filter(f => f.status === 'partial').length;
    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Fee Management</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[['Paid', paidCount, '#10b981'], ['Partial', partialCount, '#f59e0b'], ['Unpaid', unpaidCount, '#f43f5e']].map(([l, v, c]) => (
                    <div key={l} className="kpi-card" style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '32px', fontWeight: 800, color: c, fontFamily: 'Outfit', margin: 0 }}>{v}</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{l}</p>
                    </div>
                ))}
            </div>
            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Student</th><th>Roll</th><th>Semester</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                        <tbody>
                            {fees.map(f => (
                                <tr key={f.id}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{f.student_name}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--cyan)', fontSize: '12px' }}>{f.student_roll}</td>
                                    <td>Sem {f.semester}</td>
                                    <td>₹{Number(f.amount_due).toLocaleString()}</td>
                                    <td>₹{Number(f.amount_paid).toLocaleString()}</td>
                                    <td style={{ color: f.balance > 0 ? '#fb7185' : '#34d399' }}>₹{Number(f.balance).toLocaleString()}</td>
                                    <td><span className={`badge badge-${f.status}`}>{f.status}</span></td>
                                </tr>
                            ))}
                            {!fees.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No fee records found.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function LibraryPage() {
    const [books, setBooks] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/library/').then(r => setBooks(r.data.results || r.data)).catch(() => { }).finally(() => setLoading(false)); }, []);
    const filtered = books.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));
    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>Library Catalog</h1>
            <input className="premium-input" placeholder="Search by title or author…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '20px', maxWidth: '360px' }} />
            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Total</th><th>Available</th></tr></thead>
                        <tbody>
                            {filtered.map(b => (
                                <tr key={b.id}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{b.title}</td>
                                    <td>{b.author}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{b.isbn}</td>
                                    <td>{b.total_copies}</td>
                                    <td><span className={`badge ${b.available_copies > 0 ? 'badge-safe' : 'badge-critical'}`}>{b.available_copies}</span></td>
                                </tr>
                            ))}
                            {!filtered.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No books found.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    return (
        <div className="app-container">
            <Sidebar navItems={navItems} />
            <main className="main-content">
                <Routes>
                    <Route index element={<AdminHome />} />
                    <Route path="students" element={<StudentsPage />} />
                    <Route path="faculty" element={<FacultyPage />} />
                    <Route path="subjects" element={<SubjectsPage />} />
                    <Route path="rooms" element={<RoomsPage />} />
                    <Route path="timeslots" element={<TimeSlotsPage />} />
                    <Route path="timetable" element={<TimetableGADashboard />} />
                    <Route path="fees" element={<FeeAdminPage />} />
                    <Route path="library" element={<LibraryPage />} />
                </Routes>
            </main>
        </div>
    );
}

/* ════════════════════════════════════════════
   SUBJECTS PAGE — with inline faculty assign
   ════════════════════════════════════════════ */
function SubjectsPage() {
    const [subjects, setSubjects] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ code: '', name: '', faculty: '', semester: 1, credits: 3, is_special: false });
    const [submitting, setSubmitting] = useState(false);
    const [patching, setPatching] = useState(null);

    const fetchData = () => {
        setLoading(true);
        Promise.all([api.get('/subjects/'), api.get('/faculty/')])
            .then(([resSubj, resFac]) => {
                setSubjects(resSubj.data.results || resSubj.data);
                setFaculties(resFac.data.results || resFac.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...form, faculty: form.faculty || null };
            await api.post('/subjects/', payload);
            setShowForm(false);
            setForm({ code: '', name: '', faculty: '', semester: 1, credits: 3, is_special: false });
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data ? JSON.stringify(err.response.data).replace(/["{}\[\]]/g, ' ') : err.message;
            alert('Failed to add subject. Error: ' + errMsg);
        } finally { setSubmitting(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this subject?')) return;
        try { await api.delete(`/subjects/${id}/`); fetchData(); }
        catch { alert('Failed to delete subject.'); }
    };

    const handlePatch = async (id, data) => {
        setPatching(id);
        try { await api.patch(`/subjects/${id}/`, data); fetchData(); }
        catch (err) { alert('Update failed: ' + JSON.stringify(err.response?.data)); }
        finally { setPatching(null); }
    };

    const getFacultyName = (s) => {
        if (s.faculty_name) return s.faculty_name;
        const fp = faculties.find(f => f.id === s.faculty);
        return fp ? `${fp.user?.first_name || ''} ${fp.user?.last_name || ''}`.trim() : '—';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Subjects</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>{subjects.length} subjects configured</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {faculties.length === 0 && <span style={{ fontSize: 12, color: '#fbbf24', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13}/> Add Faculty first</span>}
                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        <BookOpen size={15} /> {showForm ? 'Cancel' : 'Add Subject'}
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="premium-card" style={{ padding: '24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                        <label className="form-label">Subject Code *</label>
                        <input className="premium-input" placeholder="e.g. CS401" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
                    </div>
                    <div>
                        <label className="form-label">Subject Name *</label>
                        <input className="premium-input" placeholder="e.g. Data Structures" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="form-label">Assign Faculty <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                        <select className="premium-input" value={form.faculty} onChange={e => setForm({ ...form, faculty: e.target.value })}>
                            <option value="">— Unassigned —</option>
                            {faculties.map(f => (
                                <option key={f.id} value={f.id}>{f.user?.first_name} {f.user?.last_name} ({f.department || 'No Dept'})</option>
                            ))}
                        </select>
                        {faculties.length === 0 && <p style={{ fontSize: 11, color: '#fb7185', margin: '4px 0 0' }}>No faculty added yet — <a href="/admin/faculty" style={{ color: '#a78bfa' }}>Add Faculty →</a></p>}
                    </div>
                    <div>
                        <label className="form-label">Semester *</label>
                        <input className="premium-input" type="number" min="1" max="8" value={form.semester} onChange={e => setForm({ ...form, semester: +e.target.value })} required />
                    </div>
                    <div>
                        <label className="form-label">Credits *</label>
                        <input className="premium-input" type="number" min="1" max="10" value={form.credits} onChange={e => setForm({ ...form, credits: +e.target.value })} required />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: form.is_special ? '#fbbf24' : 'var(--text-secondary)', fontWeight: 600 }}>
                            <input type="checkbox" checked={form.is_special} onChange={e => setForm({ ...form, is_special: e.target.checked })} />
                            ★ Mark as Special (Library / Sports — 2×/week)
                        </label>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <button className="btn-primary" type="submit" disabled={submitting}>
                            {submitting ? <><Loader2 size={13}/> Saving...</> : <><Plus size={13}/> Save Subject</>}
                        </button>
                    </div>
                </form>
            )}

            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Code</th><th>Subject Name</th>
                                <th>Assigned Faculty</th>
                                <th>Sem</th><th>Credits</th><th>Special</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjects.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>{s.code}</td>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</td>
                                    <td>
                                        {/* Inline faculty reassign dropdown */}
                                        <select
                                            value={s.faculty || ''}
                                            disabled={patching === s.id}
                                            onChange={e => handlePatch(s.id, { faculty: e.target.value || null })}
                                            style={{ background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.3)', color: '#a78bfa', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', minWidth: 160 }}
                                        >
                                            <option value="" style={{ background: '#111', color: '#94a3b8' }}>— Unassigned —</option>
                                            {faculties.map(f => (
                                                <option key={f.id} value={f.id} style={{ background: '#111', color: '#fff' }}>
                                                    {f.user?.first_name} {f.user?.last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td><span className="badge badge-safe">Sem {s.semester}</span></td>
                                    <td><span className="badge badge-neutral">{s.credits} cr</span></td>
                                    <td>
                                        <button
                                            disabled={patching === s.id}
                                            onClick={() => handlePatch(s.id, { is_special: !s.is_special })}
                                            title={s.is_special ? 'Special (Library/Sports) — click to unmark' : 'Regular — click to mark as Special'}
                                            style={{ background: s.is_special ? 'rgba(245,158,11,.2)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: s.is_special ? '#fbbf24' : 'var(--text-muted)', fontWeight: 700 }}
                                        >
                                            {s.is_special ? '★' : '☆'}
                                        </button>
                                    </td>
                                    <td>
                                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDelete(s.id)}>
                                            <Trash2 size={11}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!subjects.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No subjects found. Add one above.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════
   FACULTY PAGE — Full CRUD
   ════════════════════════════════════════════ */
function FacultyPage() {
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);   // faculty profile id being edited
    const [form, setForm] = useState({
        // User fields
        username: '', email: '', first_name: '', last_name: '', password: '',
        // Profile fields
        department: '', max_hours_per_week: 18,
    });
    const [editForm, setEditForm] = useState({ department: '', max_hours_per_week: 18 });
    const [submitting, setSubmitting] = useState(false);
    const [patching, setPatching] = useState(null);

    const fetchFaculty = () => {
        setLoading(true);
        api.get('/faculty/')
            .then(r => setFaculty(r.data.results || r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchFaculty(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        let userId = null;
        try {
            // Step 1: Create the user account with role=faculty
            const userRes = await api.post('/users/', {
                username: form.username,
                email: form.email,
                first_name: form.first_name,
                last_name: form.last_name,
                password: form.password,
                role: 'faculty',
            });
            userId = userRes.data.id;

            try {
                // Step 2: Create the FacultyProfile linked to that user
                await api.post('/faculty/', {
                    user_pk: userId,
                    department: form.department,
                    max_hours_per_week: form.max_hours_per_week,
                });
            } catch (profileErr) {
                // Rollback user creation if profile fails
                if (userId) await api.delete(`/users/${userId}/`).catch(console.error);
                throw profileErr; // Re-throw to be caught by the outer catch
            }

            setShowForm(false);
            setForm({ username: '', email: '', first_name: '', last_name: '', password: '', department: '', max_hours_per_week: 18 });
            fetchFaculty();
        } catch (err) {
            const errMsg = err.response?.data ? JSON.stringify(err.response.data).replace(/["{}\[\]]/g, ' ') : err.message;
            alert('Failed to create faculty: ' + errMsg);
        } finally { setSubmitting(false); }
    };

    const startEdit = (fp) => {
        setEditId(fp.id);
        setEditForm({ department: fp.department || '', max_hours_per_week: fp.max_hours_per_week || 18 });
    };

    const handleEdit = async (id) => {
        setPatching(id);
        try {
            await api.patch(`/faculty/${id}/`, editForm);
            setEditId(null);
            fetchFaculty();
        } catch (err) {
            alert('Update failed: ' + JSON.stringify(err.response?.data));
        } finally { setPatching(null); }
    };

    const handleDelete = async (fp) => {
        if (!window.confirm(`Delete faculty account for ${fp.user?.first_name} ${fp.user?.last_name}? This will also remove their user account.`)) return;
        try {
            await api.delete(`/faculty/${fp.id}/`);
            // Also delete the user account
            if (fp.user?.id) await api.delete(`/users/${fp.user.id}/`).catch(() => {});
            fetchFaculty();
        } catch (err) {
            alert('Delete failed: ' + JSON.stringify(err.response?.data));
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Faculty</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>{faculty.length} faculty members</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    <UserCheck size={15} /> {showForm ? 'Cancel' : 'Add Faculty'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="premium-card" style={{ padding: '24px', marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserCheck size={14}/> Create Faculty Account
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {[
                            ['username', 'Username *', 'e.g. dr.sharma', 'text'],
                            ['email', 'Email *', 'faculty@college.edu', 'email'],
                            ['first_name', 'First Name *', 'Dr. Priya', 'text'],
                            ['last_name', 'Last Name *', 'Sharma', 'text'],
                            ['password', 'Password *', 'Min 8 chars', 'password'],
                            ['department', 'Department *', 'e.g. Computer Science', 'text'],
                        ].map(([field, label, ph, type]) => (
                            <div key={field}>
                                <label className="form-label">{label}</label>
                                <input className="premium-input" type={type} placeholder={ph}
                                    value={form[field]}
                                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                                    required />
                            </div>
                        ))}
                        <div>
                            <label className="form-label">Max Teaching Hours / Week</label>
                            <input className="premium-input" type="number" min="1" max="40"
                                value={form.max_hours_per_week}
                                onChange={e => setForm({ ...form, max_hours_per_week: +e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
                                {submitting ? <><Loader2 size={13}/> Creating...</> : <><Plus size={13}/> Create Faculty</>}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead>
                            <tr><th>Name</th><th>Username</th><th>Email</th><th>Department</th><th>Max Hrs/Wk</th><th>Subjects</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {faculty.map(fp => (
                                <tr key={fp.id}>
                                    <td style={{ fontWeight: 700, color: '#a78bfa' }}>
                                        {fp.user?.first_name} {fp.user?.last_name}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#06b6d4' }}>{fp.user?.username}</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fp.user?.email}</td>
                                    <td>
                                        {editId === fp.id ? (
                                            <input className="premium-input" value={editForm.department}
                                                onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                                                style={{ padding: '4px 8px', fontSize: 12, width: 140 }}/>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fp.department || '—'}</span>
                                        )}
                                    </td>
                                    <td>
                                        {editId === fp.id ? (
                                            <input className="premium-input" type="number" min={1} max={40}
                                                value={editForm.max_hours_per_week}
                                                onChange={e => setEditForm({ ...editForm, max_hours_per_week: +e.target.value })}
                                                style={{ padding: '4px 8px', fontSize: 12, width: 70 }}/>
                                        ) : (
                                            <span className="badge badge-safe">{fp.max_hours_per_week} h/wk</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className="badge badge-neutral">{fp.subjects_count ?? '—'} subj</span>
                                    </td>
                                    <td style={{ display: 'flex', gap: 6 }}>
                                        {editId === fp.id ? (
                                            <>
                                                <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}
                                                    disabled={patching === fp.id}
                                                    onClick={() => handleEdit(fp.id)}>
                                                    <Save size={11}/> Save
                                                </button>
                                                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                                                    onClick={() => setEditId(null)}><X size={11}/></button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                                                    onClick={() => startEdit(fp)}><Pencil size={11}/></button>
                                                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11, color: '#fb7185' }}
                                                    onClick={() => handleDelete(fp)}><Trash2 size={11}/></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!faculty.length && (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                                    No faculty added yet. Click " Add Faculty" to create one.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function RoomsPage() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', capacity: 60, is_lab: false });
    const [submitting, setSubmitting] = useState(false);

    const fetchData = () => {
        setLoading(true);
        api.get('/rooms/')
            .then(res => setRooms(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/rooms/', form);
            setShowForm(false);
            setForm({ name: '', capacity: 60, is_lab: false });
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data ? JSON.stringify(err.response.data).replace(/["{}[\]]/g, ' ') : err.message;
            alert('Failed to add room. Error: ' + errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this room?')) return;
        try {
            await api.delete(`/rooms/${id}/`);
            fetchData();
        } catch (err) {
            alert('Failed to delete room.');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Rooms</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>Physical locations for timetable mapping</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    <LayoutDashboard size={15} /> {showForm ? 'Cancel' : 'Add Room'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="premium-card" style={{ padding: '24px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label className="form-label">Room Identifier / Name</label>
                        <input className="premium-input" placeholder="e.g. Block A 101" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="form-label">Capacity</label>
                        <input className="premium-input" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required />
                    </div>
                    <div style={{ flex: 1, paddingBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.is_lab} onChange={e => setForm({ ...form, is_lab: e.target.checked })} />
                            Is Laboratory Room
                        </label>
                    </div>
                    <button className="btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Room'}
                    </button>
                </form>
            )}

            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Room Name</th><th>Capacity</th><th>Type</th><th>Action</th></tr></thead>
                        <tbody>
                            {rooms.map(r => (
                                <tr key={r.id}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.name}</td>
                                    <td><span className="badge badge-safe">{r.capacity} seats</span></td>
                                    <td>{r.is_lab ? <span className="badge badge-warning">Lab</span> : <span className="badge badge-safe">Lecture</span>}</td>
                                    <td><button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDelete(r.id)}>Delete</button></td>
                                </tr>
                            ))}
                            {!rooms.length && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No rooms configured.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function TimeSlotsPage() {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ day: 0, period: 1, start_time: '09:00', end_time: '10:00', slot_label: '' });
    const [submitting, setSubmitting] = useState(false);
    const [patching, setPatching] = useState(null);

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const SLOT_LABELS = [['', 'Normal Period'], ['break', 'Break'], ['lunch', 'Lunch'], ['club', 'Club Activities']];
    const LABEL_COLORS = { '': '#a78bfa', break: '#fbbf24', lunch: '#34d399', club: '#fb7185' };
    const LABEL_ICONS = { '': '🕐', break: '☕', lunch: '🍽️', club: '🎭' };

    const fetchData = () => {
        setLoading(true);
        api.get('/timeslots/')
            .then(res => setSlots(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/timeslots/', form);
            setShowForm(false);
            setForm({ day: 0, period: 1, start_time: '09:00', end_time: '10:00', slot_label: '' });
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data ? JSON.stringify(err.response.data).replace(/["{}[\]]/g, ' ') : err.message;
            alert('Failed to add timeslot. Error: ' + errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePatch = async (id, data) => {
        setPatching(id);
        try { await api.patch(`/timeslots/${id}/`, data); fetchData(); }
        catch (err) { alert('Update failed.'); }
        finally { setPatching(null); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this timeslot?')) return;
        try {
            await api.delete(`/timeslots/${id}/`);
            fetchData();
        } catch (err) {
            alert('Failed to delete timeslot.');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Time Slots</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>Available blocks for the genetic algorithm to place classes</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Calendar size={15} /> {showForm ? 'Cancel' : 'Add Time Slot'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="premium-card" style={{ padding: '20px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 80px 120px 120px 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                    <div>
                        <label className="form-label">Day of Week</label>
                        <select className="premium-input" value={form.day} onChange={e => setForm({ ...form, day: Number(e.target.value) })} required>
                            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Period</label>
                        <input className="premium-input" type="number" min="1" max="10" value={form.period} onChange={e => setForm({ ...form, period: Number(e.target.value) })} required />
                    </div>
                    <div>
                        <label className="form-label">Start Time</label>
                        <input className="premium-input" type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
                    </div>
                    <div>
                        <label className="form-label">End Time</label>
                        <input className="premium-input" type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
                    </div>
                    <div>
                        <label className="form-label">Slot Type</label>
                        <select className="premium-input" value={form.slot_label} onChange={e => setForm({ ...form, slot_label: e.target.value })}>
                            {SLOT_LABELS.map(([v, l]) => <option key={v} value={v}>{LABEL_ICONS[v]} {l}</option>)}
                        </select>
                    </div>
                    <button className="btn-primary" type="submit" disabled={submitting} style={{ padding: '10px 16px' }}>
                        {submitting ? 'Saving...' : 'Save'}
                    </button>
                </form>
            )}

            <div className="premium-card" style={{ overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                    <table className="premium-table">
                        <thead><tr><th>Day</th><th>Period</th><th>Timing</th><th>Type</th><th>Lock</th><th>Action</th></tr></thead>
                        <tbody>
                            {slots.map(s => {
                                const col = LABEL_COLORS[s.slot_label || ''];
                                const icon = LABEL_ICONS[s.slot_label || ''];
                                const lblText = SLOT_LABELS.find(([v]) => v === (s.slot_label || ''))?.[1] || 'Normal';
                                return (
                                    <tr key={s.id}>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.day_name}</td>
                                        <td><span className="badge badge-safe">Period {s.period}</span></td>
                                        <td style={{ fontFamily: 'monospace', color: '#06b6d4', fontSize: 13 }}>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</td>
                                        <td>
                                            <select value={s.slot_label || ''} disabled={patching === s.id}
                                                onChange={e => handlePatch(s.id, { slot_label: e.target.value })}
                                                style={{ background: `${col}18`, border: `1px solid ${col}40`, color: col, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                                {SLOT_LABELS.map(([v, l]) => <option key={v} value={v} style={{ background: '#111', color: '#fff' }}>{LABEL_ICONS[v]} {l}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <button disabled={patching === s.id}
                                                onClick={() => handlePatch(s.id, { is_locked: !s.is_locked })}
                                                style={{ background: s.is_locked ? 'rgba(244,63,94,.15)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: s.is_locked ? '#fb7185' : 'var(--text-muted)', fontWeight: 600 }}>
                                                {s.is_locked ? '🔒 Locked' : '🔓 Unlock'}
                                            </button>
                                        </td>
                                        <td><button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDelete(s.id)}>Delete</button></td>
                                    </tr>
                                );
                            })}
                            {!slots.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No time slots configured.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
