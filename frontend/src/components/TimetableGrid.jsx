import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loader2, Zap, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const SUBJECT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0284c7', '#059669'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableGrid({ apiData }) {
    const { user } = useAuth();
    const [timetable, setTimetable] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const fetchTimetable = async () => {
        if (apiData) return; // Prop overrides DB fetch
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/timetable/');
            // Transform the model output to match GA output properties
            const formatted = res.data.map(item => ({
                subject_code: item.subject?.code,
                subject_name: item.subject?.name,
                semester: item.semester,
                faculty_name: `${item.faculty?.user?.first_name} ${item.faculty?.user?.last_name}`,
                room: item.room?.name,
                day: item.timeslot?.day,
                day_name: item.timeslot?.day_name,
                period: item.timeslot?.period,
                start_time: item.timeslot?.start_time,
                end_time: item.timeslot?.end_time,
            }));
            setTimetable(formatted);
        } catch (err) {
            setError('Failed to load timetable from database.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (apiData) {
            setTimetable(apiData);
        } else {
            fetchTimetable();
        }
    }, [apiData]);

    const generate = async () => {
        setGenerating(true);
        setError('');
        setTimetable([]);
        setMeta(null);
        try {
            const res = await api.post('/timetable/generate/', {});
            setTimetable(res.data.timetable || []);
            setMeta({ conflictScore: res.data.conflict_score, generations: res.data.generations });
        } catch (err) {
            setError(err.response?.data?.detail || 'Generation failed. Check that subjects, rooms, faculty, and timeslots are configured.');
        } finally {
            setGenerating(false);
        }
    };

    // Build color map for subjects
    const subjectColors = {};
    [...new Set(timetable.map(e => e.subject_code))].forEach((code, i) => {
        if (code) {
            subjectColors[code] = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
        }
    });

    // Build grid: { day: { period: entry } }
    const grid = {};
    const periods = [...new Set(timetable.map(e => e.period))].sort((a, b) => a - b);
    const days = [...new Set(timetable.map(e => e.day))].sort((a, b) => a - b);
    timetable.forEach(e => {
        if (e.day === undefined || e.period === undefined) return;
        if (!grid[e.day]) grid[e.day] = {};
        grid[e.day][e.period] = e;
    });

    return (
        <div>
            {!apiData && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{user?.role === 'faculty' ? 'My Timetable' : 'Master Timetable'}</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
                            {user?.role === 'admin' ? 'Genetic Algorithm — conflict-free schedule generation' : 'Your dedicated weekly schedule'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-secondary" onClick={fetchTimetable} disabled={loading || generating}>
                            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> {loading ? 'Loading...' : 'Refresh API'}
                        </button>
                        {user?.role === 'admin' && (
                            <button className="btn-primary" onClick={generate} disabled={loading || generating}>
                                {generating ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Running GA…</> : <><Zap size={15} /> Generate Timetable</>}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {meta && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <div className="alert-banner alert-success" style={{ flex: 1 }}>
                        <CheckCircle size={16} />
                        <span>Conflict Score: <strong>{meta.conflictScore}</strong> · Completed in <strong>{meta.generations}</strong> generations</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert-banner alert-danger" style={{ marginBottom: '20px' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {generating && (
                <div className="premium-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed', margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Running genetic algorithm across 100 generations…</p>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '13px' }}>Optimising for room conflicts, faculty hours, and semester clashes</p>
                </div>
            )}

            {!generating && timetable.length > 0 && (
                <div className="premium-card" style={{ padding: '20px', overflowX: 'auto' }}>
                    {/* Color legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                        {Object.entries(subjectColors).map(([code, color]) => (
                            <span key={code} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: `${color}22`, border: `1px solid ${color}44`, fontSize: '12px', color }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                                {code}
                            </span>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${periods.length || 1}, 1fr)`, gap: '4px', minWidth: '640px' }}>
                        {/* Header: periods */}
                        <div className="tt-header-v2">Day / Period</div>
                        {periods.map(p => {
                            const sample = timetable.find(e => e.period === p);
                            return (
                                <div key={p} className="tt-header-v2">
                                    P{p}{sample ? <span style={{ display: 'block', fontWeight: 400, fontSize: '10px', color: 'var(--text-muted)' }}>{sample.start_time?.slice(0, 5)}</span> : null}
                                </div>
                            );
                        })}

                        {/* Rows: each day */}
                        {DAYS.map((dayName, dayIdx) => (
                            <div style={{ display: 'contents' }} key={`day-row-${dayIdx}`}>
                                <div key={`day-${dayIdx}`} className="tt-header-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dayName.slice(0, 3)}</div>
                                {periods.map(p => {
                                    const entry = grid[dayIdx]?.[p];
                                    if (!entry) return <div key={`${dayIdx}-${p}`} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', minHeight: '60px' }} />;
                                    const color = subjectColors[entry.subject_code] || '#555';
                                    return (
                                        <div key={`${dayIdx}-${p}`} className="tt-cell-v2" style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
                                            <span style={{ fontSize: '12px', fontWeight: 700 }}>{entry.subject_code}</span>
                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>{entry.room || 'TBA'}</span>
                                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{entry.faculty_name ? entry.faculty_name.split(' ').slice(-1)[0] : 'TBA'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!generating && !loading && !timetable.length && !error && (
                <div className="premium-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Zap size={40} style={{ color: 'var(--violet-light)', margin: '0 auto 16px', display: 'block', opacity: 0.5 }} />
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '16px' }}>{user?.role === 'admin' ? <>Click <strong>Generate Timetable</strong> to run the Genetic Algorithm</> : "No timetable entries found."}</p>
                    <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: '13px' }}>{user?.role === 'admin' ? "Ensure rooms, timeslots, faculty profiles, and subjects are added first." : "Check back later when the admin generates the schedule."}</p>
                </div>
            )}
        </div>
    );
}
