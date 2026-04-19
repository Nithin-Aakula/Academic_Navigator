import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api/client';
import {
    Zap, Loader2, CheckCircle, AlertTriangle, RefreshCw,
    Users, BookOpen, Calendar, Plus, Trash2, X, Printer,
    Settings, Lock, Unlock
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

/* ─────────── helpers ─────────── */
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const YEAR_LABELS = { 1: 'I', 2: 'I', 3: 'II', 4: 'II', 5: 'III', 6: 'III', 7: 'IV', 8: 'IV' };
const COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#f43f5e','#8b5cf6','#0284c7','#059669','#d97706','#db2777'];
const ordinal = n => n + (['th','st','nd','rd'][((n % 100) - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');

const tabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
    borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600, background: active ? '#7c3aed' : 'rgba(255,255,255,0.05)',
    color: active ? '#fff' : 'var(--text-secondary)', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
    transition: 'all 0.18s',
});

/* ─────────── Alert ─────────── */
function Alert({ type, children }) {
    const map = { error:['rgba(244,63,94,.1)','rgba(244,63,94,.3)','#fb7185'], success:['rgba(16,185,129,.1)','rgba(16,185,129,.3)','#34d399'], warning:['rgba(245,158,11,.1)','rgba(245,158,11,.3)','#fbbf24'] };
    const [bg,border,c] = map[type]||map.warning;
    return <div style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${border}`, background:bg, color:c, fontSize:13, display:'flex', alignItems:'flex-start', gap:10, marginBottom:14 }}>
        {type==='error'&&<AlertTriangle size={14} style={{flexShrink:0,marginTop:2}}/>}
        {type==='success'&&<CheckCircle size={14} style={{flexShrink:0,marginTop:2}}/>}
        {type==='warning'&&<AlertTriangle size={14} style={{flexShrink:0,marginTop:2}}/>}
        <span>{children}</span>
    </div>;
}

/* ─────────── Faculty Over-Leverage ─────────── */
function ConstraintErrors({ errors, onDismiss }) {
    if (!errors?.length) return null;
    return (
        <div className="premium-card" style={{ padding:20, marginBottom:20, border:'1px solid rgba(244,63,94,.4)', background:'rgba(244,63,94,.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#fb7185', display:'flex', alignItems:'center', gap:8 }}><AlertTriangle size={14}/> Faculty Over-Leverage Detected</h3>
                <button onClick={onDismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14}/></button>
            </div>
            <p style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:10 }}>The following faculty are assigned more teaching sessions than their weekly capacity. Reassign subjects or increase their max hours.</p>
            <table className="premium-table" style={{ fontSize:12 }}>
                <thead><tr><th>Faculty</th><th>Needed</th><th>Capacity</th><th>Excess</th></tr></thead>
                <tbody>{errors.map(e=>(
                    <tr key={e.faculty_id}>
                        <td style={{ fontWeight:700 }}>{e.faculty_name}</td>
                        <td>{e.demand} hrs/wk</td><td>{e.capacity} hrs/wk</td>
                        <td style={{ color:'#fb7185', fontWeight:700 }}>+{e.over_by}</td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
    );
}

/* ─────────── Conflict Heatmap ─────────── */
function ConflictHeatmap({ score, running, timetable, timeslots }) {
    const periods = useMemo(()=>[...new Set(timeslots.map(t=>t.period))].sort((a,b)=>a-b),[timeslots]);
    const activeDays = useMemo(()=>DAYS_FULL.filter((_,i)=>timeslots.some(t=>t.day===i)),[timeslots]);
    const isZero = score!==null && score>=0;

    const getCellBg = (dIdx, p) => {
        if (running) return 'rgba(245,158,11,.18)';
        if (!timetable.length) return 'rgba(255,255,255,.03)';
        const ts = timeslots.find(t=>t.day===dIdx&&t.period===p);
        if (!ts) return 'rgba(255,255,255,.03)';
        if (ts.slot_label) return 'rgba(255,255,255,.06)';
        const cellEntries = timetable.filter(e=>e.timeslot===ts.id||e.timeslot?.id===ts.id);
        if (cellEntries.length>1) return 'rgba(244,63,94,.3)';
        if (cellEntries.length===1 && isZero) return 'rgba(16,185,129,.25)';
        if (cellEntries.length===1) return 'rgba(245,158,11,.18)';
        return 'rgba(255,255,255,.03)';
    };

    return (
        <div className="premium-card" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>Conflict Heatmap</h3>
                <span style={{ fontSize:12, fontWeight:700, color: running?'#fbbf24': isZero?'#34d399':'#94a3b8', display:'flex', alignItems:'center', gap:6 }}>
                    {running ? <><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> Computing…</> : isZero ? <><CheckCircle size={12}/> Zero Conflict (Score: {score})</> : score!==null ? <><AlertTriangle size={12}/> Score: {score}</> : 'Run GA to populate'}
                </span>
            </div>
            {timeslots.length>0 && (
                <div style={{ overflowX:'auto' }}>
                    <div style={{ display:'grid', gridTemplateColumns:`70px repeat(${periods.length},1fr)`, gap:3, minWidth:500 }}>
                        <div style={{ fontSize:10, color:'var(--text-muted)', padding:'5px 4px', fontWeight:600 }}>Day / P</div>
                        {periods.map(p=>{
                            const ts=timeslots.find(t=>t.period===p);
                            const label=ts?.slot_label;
                            return <div key={p} style={{ fontSize:10, color: label?'#fbbf24':'var(--text-muted)', padding:'5px 4px', textAlign:'center', fontWeight:600 }}>
                                {label?label.slice(0,2).toUpperCase():`P${p}`}
                            </div>;
                        })}
                        {activeDays.map((day,i)=>{
                            const dIdx=DAYS_FULL.indexOf(day);
                            return <div key={i} style={{ display:'contents' }}>
                                <div style={{ fontSize:10, color:'var(--text-secondary)', padding:'5px 4px', fontWeight:600, display:'flex', alignItems:'center' }}>{day.slice(0,3)}</div>
                                {periods.map(p=>(
                                    <div key={p} style={{ height:28, borderRadius:4, background:getCellBg(dIdx,p), transition:'background .6s ease', border:'1px solid rgba(255,255,255,.04)' }}/>
                                ))}
                            </div>;
                        })}
                    </div>
                </div>
            )}
            <div style={{ display:'flex', gap:16, marginTop:10, fontSize:10, color:'var(--text-muted)' }}>
                {[['rgba(244,63,94,.3)','Hard conflict'],['rgba(245,158,11,.18)','Pending'],['rgba(16,185,129,.25)','Conflict-free'],['rgba(255,255,255,.06)','Break/Club']].map(([c,l])=>(
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10,height:10,borderRadius:2,background:c }}/>{l}</div>
                ))}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   CLASSIC DEPARTMENTAL TIMETABLE VIEW  (matches image)
   ──────────────────────────────────────────────────────────────── */
function ClassicTimetableView({ group, entries, timeslots, subjects, printRef }) {
    // --- organize periods ---
    const periodNums = useMemo(() => [...new Set(timeslots.map(t=>t.period))].sort((a,b)=>a-b), [timeslots]);
    const activeDayIndices = useMemo(()=>([0,1,2,3,4,5].filter(i=>timeslots.some(t=>t.day===i))), [timeslots]);

    // Get representative slot for each period (same label across all days)
    const periodMeta = useMemo(()=>{
        const m={};
        periodNums.forEach(p=>{
            const sample = timeslots.find(t=>t.period===p);
            m[p] = { label: sample?.slot_label||'', start: sample?.start_time, end: sample?.end_time };
        });
        return m;
    },[periodNums, timeslots]);

    const normalPeriods = periodNums.filter(p=>periodMeta[p].label==='');
    const breakPeriods = periodNums.filter(p=>periodMeta[p].label==='break');
    const lunchPeriods = periodNums.filter(p=>periodMeta[p].label==='lunch');
    const clubPeriods = periodNums.filter(p=>periodMeta[p].label==='club');

    const getEntry = (dayIdx, period) =>
        entries.find(e => e.day===dayIdx && e.period===period);

    // Compute serial numbers for normal periods (1st Hour, 2nd Hour, …)
    let hourCounter = 0;
    const normalPeriodHour = {};
    periodNums.forEach(p => {
        if (periodMeta[p].label==='') {
            hourCounter++;
            normalPeriodHour[p]=hourCounter;
        }
    });

    const yearLabel = YEAR_LABELS[group.semester] || 'I';
    const numDays = activeDayIndices.length;

    // Which special periods need rowspan (break/lunch)?
    const hasBreak = breakPeriods.length > 0;
    const hasLunch = lunchPeriods.length > 0;
    const hasClub = clubPeriods.length > 0;

    // Compute used subjects for legend
    const usedSubjectIds = new Set(entries.map(e=>e.subject));
    const usedSubjects = subjects.filter(s=>usedSubjectIds.has(s.id));

    const tdCell = { border:'1px solid #333', padding:'6px 8px', textAlign:'center', verticalAlign:'middle', fontSize:12 };
    const thCell = { ...tdCell, background:'#1a1a2e', color:'#a78bfa', fontWeight:700, fontSize:11, padding:'8px 6px' };

    return (
        <div ref={printRef} style={{ fontFamily:"'Segoe UI', Arial, sans-serif" }}>
            {/* ── Official Header ── */}
            <div style={{ textAlign:'center', marginBottom:12, lineHeight:1.6 }}>
                <div style={{ fontSize:16, fontWeight:800, letterSpacing:2, color:'var(--text-primary)', textTransform:'uppercase' }}>
                    Department of {group.department || '—'}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', letterSpacing:1 }}>
                    Time Table for Academic Year (2025-26)
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:32, marginTop:6, fontSize:12, color:'var(--text-secondary)', fontWeight:600, flexWrap:'wrap' }}>
                    <span>YEAR: <strong style={{ color:'#a78bfa' }}>{yearLabel}</strong></span>
                    <span>SEM: <strong style={{ color:'#a78bfa' }}>{group.semester}</strong></span>
                    <span>SECTION: <strong style={{ color:'#a78bfa' }}>{group.name}</strong></span>
                    <span>ROOM NO:- <strong style={{ color:'#06b6d4' }}>{group.room_name || '—'}</strong></span>
                    {group.effective_date && <span>W.e.f: <strong style={{ color:'#10b981' }}>{group.effective_date}</strong></span>}
                </div>
            </div>

            {/* ── Main Timetable Table ── */}
            <div style={{ overflowX:'auto', borderRadius:8, border:'2px solid rgba(124,58,237,.4)', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                    <thead>
                        <tr style={{ background:'rgba(124,58,237,.15)' }}>
                            <th style={{ ...thCell, width:90, minWidth:80 }}>Periods / Days</th>
                            {periodNums.map(p => {
                                const meta = periodMeta[p];
                                if (meta.label==='break') return (
                                    <th key={p} style={{ ...thCell, width:40, color:'#fbbf24', background:'rgba(245,158,11,.12)' }}>
                                        <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:11, letterSpacing:2 }}>BREAK</div>
                                        <div style={{ fontSize:9, writingMode:'vertical-rl', transform:'rotate(180deg)', fontWeight:400, color:'#94a3b8' }}>{meta.start?.slice(0,5)}-{meta.end?.slice(0,5)}</div>
                                    </th>
                                );
                                if (meta.label==='lunch') return (
                                    <th key={p} style={{ ...thCell, width:40, color:'#34d399', background:'rgba(16,185,129,.10)' }}>
                                        <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:11, letterSpacing:2 }}>LUNCH</div>
                                    </th>
                                );
                                if (meta.label==='club') return (
                                    <th key={p} style={{ ...thCell, color:'#fb7185', background:'rgba(244,63,94,.10)', minWidth:110 }}>
                                        Club Activities<br/>
                                        <span style={{ fontSize:9, fontWeight:400, color:'#94a3b8' }}>{meta.start?.slice(0,5)}-{meta.end?.slice(0,5)}</span>
                                    </th>
                                );
                                const hour = normalPeriodHour[p];
                                return (
                                    <th key={p} style={{ ...thCell, minWidth:110 }}>
                                        {ordinal(hour)} Hour<br/>
                                        <span style={{ fontSize:9, fontWeight:400, color:'#94a3b8' }}>{meta.start?.slice(0,5)}-{meta.end?.slice(0,5)}</span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {activeDayIndices.map((dIdx, rowIndex) => (
                            <tr key={dIdx} style={{ background: rowIndex%2===0 ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.2)' }}>
                                {/* Day label */}
                                <td style={{ ...tdCell, fontWeight:800, fontSize:13, color:'#a78bfa', background:'rgba(124,58,237,.10)' }}>
                                    {DAYS_SHORT[dIdx]}
                                </td>

                                {/* Period cells */}
                                {periodNums.map(p => {
                                    const meta = periodMeta[p];

                                    /* BREAK — rowspan on first row only */
                                    if (meta.label==='break') {
                                        if (rowIndex===0) return (
                                            <td key={p} rowSpan={numDays}
                                                style={{ ...tdCell, background:'rgba(245,158,11,.10)', fontWeight:800, fontSize:13, letterSpacing:4, color:'#fbbf24', textAlign:'center', verticalAlign:'middle', padding:'4px 2px' }}>
                                                <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', userSelect:'none' }}>B R E A K</div>
                                            </td>
                                        );
                                        return null; // consumed by rowspan
                                    }

                                    /* LUNCH — rowspan on first row only */
                                    if (meta.label==='lunch') {
                                        if (rowIndex===0) return (
                                            <td key={p} rowSpan={numDays}
                                                style={{ ...tdCell, background:'rgba(16,185,129,.08)', fontWeight:800, fontSize:13, letterSpacing:4, color:'#34d399', textAlign:'center', verticalAlign:'middle', padding:'4px 2px' }}>
                                                <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', userSelect:'none' }}>L u n c h</div>
                                            </td>
                                        );
                                        return null;
                                    }

                                    /* CLUB ACTIVITIES — same for every day */
                                    if (meta.label==='club') {
                                        const entry = getEntry(dIdx, p);
                                        return (
                                            <td key={p} style={{ ...tdCell, background:'rgba(244,63,94,.08)', fontWeight:700, fontSize:11, color:'#fb7185' }}>
                                                {entry ? `${entry.subject_code} (${entry.room_name})` : 'CLUB ACTIVITIES'}
                                            </td>
                                        );
                                    }

                                    /* Normal period */
                                    const entry = getEntry(dIdx, p);
                                    if (!entry) return <td key={p} style={{ ...tdCell, color:'rgba(255,255,255,.15)', fontSize:11 }}>—</td>;

                                    const color = COLORS[(entry.subject||0) % COLORS.length];
                                    return (
                                        <td key={p} style={{ ...tdCell }}>
                                            <div style={{ background:`${color}15`, border:`1px solid ${color}35`, borderRadius:6, padding:'5px 6px' }}>
                                                <div style={{ fontWeight:800, fontSize:12, color }}>{entry.subject_code}</div>
                                                {entry.room_name && <div style={{ fontSize:10, color:'rgba(255,255,255,.5)', marginTop:2 }}>({entry.room_name})</div>}
                                                {entry.faculty_name && <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{entry.faculty_name?.split(' ').slice(0,2).join(' ')}</div>}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Subject Legend ── */}
            {usedSubjects.length > 0 && (
                <div style={{ borderRadius:8, border:'1px solid rgba(255,255,255,.08)', overflow:'hidden' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                            <tr style={{ background:'rgba(124,58,237,.15)' }}>
                                <th style={{ ...thCell, textAlign:'left' }}>Subject Name</th>
                                <th style={{ ...thCell, width:120 }}>Course Code</th>
                                <th style={{ ...thCell, width:80 }}>Credits</th>
                                <th style={{ ...thCell, width:160 }}>Faculty Name</th>
                                <th style={{ ...thCell, width:90 }}>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usedSubjects.map((s,i) => {
                                const color = COLORS[s.id % COLORS.length];
                                return (
                                    <tr key={s.id} style={{ borderTop:'1px solid rgba(255,255,255,.06)', background: i%2===0?'rgba(255,255,255,.01)':'rgba(0,0,0,.15)' }}>
                                        <td style={{ padding:'8px 12px', fontSize:13, fontWeight:600, color:'var(--text-primary)', borderRight:'1px solid rgba(255,255,255,.05)' }}>
                                            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:color, marginRight:8 }}/>
                                            {s.name}
                                        </td>
                                        <td style={{ padding:'8px 12px', textAlign:'center', fontFamily:'monospace', fontSize:12, fontWeight:700, color, borderRight:'1px solid rgba(255,255,255,.05)' }}>{s.code}</td>
                                        <td style={{ padding:'8px 12px', textAlign:'center', fontSize:12, color:'var(--text-secondary)', borderRight:'1px solid rgba(255,255,255,.05)' }}>{s.credits}</td>
                                        <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-secondary)', borderRight:'1px solid rgba(255,255,255,.05)' }}>{s.faculty_name || '—'}</td>
                                        <td style={{ padding:'8px 12px', textAlign:'center' }}>
                                            {s.is_special ? <span style={{ background:'rgba(245,158,11,.15)', color:'#fbbf24', padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:700 }}>★ Special</span>
                                                : <span style={{ background:'rgba(255,255,255,.06)', color:'var(--text-muted)', padding:'2px 8px', borderRadius:12, fontSize:11 }}>Regular</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {!usedSubjects.length && (
                <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>
                    No timetable generated yet for this class. Run the GA from the "⚡ Setup & Run" tab.
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   CLASS GROUP FORM PANEL
   ──────────────────────────────────────────────────────────────── */
function ClassGroupsPanel({ groups, onRefresh }) {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name:'', department:'', semester:1, room_name:'', effective_date:'' });
    const [saving, setSaving] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await api.post('/class-groups/', { ...form, effective_date: form.effective_date || null });
            setForm({ name:'', department:'', semester:1, room_name:'', effective_date:'' });
            setShowForm(false); onRefresh();
        } catch (err) { alert('Error: '+JSON.stringify(err.response?.data)); }
        finally { setSaving(false); }
    };

    const handleDelete = async id => {
        if (!window.confirm('Delete this class group and all its entries?')) return;
        await api.delete(`/class-groups/${id}/`); onRefresh();
    };

    return (
        <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Class Groups</h3>
                <button className="btn-secondary" style={{ padding:'7px 14px', fontSize:12 }} onClick={()=>setShowForm(!showForm)}>
                    <Plus size={13}/> {showForm?'Cancel':'Add Class'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="premium-card" style={{ padding:18, marginBottom:14 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px 1fr 1fr', gap:12, alignItems:'flex-end' }}>
                        {[
                            ['name','Class Name','CSE-A','text'],
                            ['department','Department','Computer Science','text'],
                            ['semester','Sem','1','number'],
                            ['room_name','Room / Lab','L-DYNAMIC','text'],
                            ['effective_date','W.e.f. Date','','date'],
                        ].map(([field,label,ph,type])=>(
                            <div key={field}>
                                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4, fontWeight:600 }}>{label}</label>
                                <input className="premium-input" type={type} placeholder={ph || undefined}
                                    value={form[field]} min={type==='number'?1:undefined} max={type==='number'?8:undefined}
                                    onChange={e=>setForm({...form,[field]:type==='number'?+e.target.value:e.target.value})}
                                    required={field!=='effective_date'&&field!=='room_name'}/>
                            </div>
                        ))}
                    </div>
                    <button className="btn-primary" type="submit" style={{ marginTop:14, padding:'9px 20px' }} disabled={saving}>
                        {saving?<Loader2 size={13}/>:<Plus size={13}/>} Save Class Group
                    </button>
                </form>
            )}

            <div className="premium-card" style={{ overflow:'hidden', padding:0 }}>
                <table className="premium-table">
                    <thead><tr><th>Class</th><th>Department</th><th>Sem</th><th>Room</th><th>W.e.f.</th><th></th></tr></thead>
                    <tbody>
                        {groups.map(g=>(
                            <tr key={g.id}>
                                <td style={{ fontWeight:800, color:'#a78bfa' }}>{g.name}</td>
                                <td style={{ color:'var(--text-secondary)', fontSize:12 }}>{g.department}</td>
                                <td><span className="badge badge-safe">Sem {g.semester} ({YEAR_LABELS[g.semester]||'?'} Yr)</span></td>
                                <td style={{ fontFamily:'monospace', fontSize:12, color:'#06b6d4' }}>{g.room_name||'—'}</td>
                                <td style={{ fontSize:12, color:'var(--text-muted)' }}>{g.effective_date||'—'}</td>
                                <td><button className="btn-secondary" style={{ padding:'3px 8px', fontSize:11 }} onClick={()=>handleDelete(g.id)}><Trash2 size={11}/></button></td>
                            </tr>
                        ))}
                        {!groups.length && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text-muted)', padding:28 }}>No classes configured yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   FACULTY ↔ SUBJECT MAPPING
   ──────────────────────────────────────────────────────────────── */
function FacultyMappingPanel({ faculties, subjects, onRefresh }) {
    const [updating, setUpdating] = useState(null);

    const patch = async (id, data) => {
        setUpdating(id);
        try { await api.patch(`/subjects/${id}/`, data); onRefresh(); }
        catch (err) { alert('Failed: '+JSON.stringify(err.response?.data)); }
        finally { setUpdating(null); }
    };

    return (
        <div>
            <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700 }}>Faculty ↔ Subject Mapping</h3>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
                Assign faculty to subjects and mark Library/Sports as ★ Special (enforces exactly 2 sessions/week per class).
            </p>
            <div className="premium-card" style={{ overflow:'hidden', padding:0 }}>
                <table className="premium-table">
                    <thead><tr><th>Subject</th><th>Semester</th><th>Assigned Faculty</th><th>Library / Sports</th></tr></thead>
                    <tbody>
                        {subjects.map(s=>(
                            <tr key={s.id}>
                                <td>
                                    <div style={{ fontWeight:700, color:'#a78bfa', fontFamily:'monospace', fontSize:12 }}>{s.code}</div>
                                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.name}</div>
                                </td>
                                <td><span className="badge badge-neutral">Sem {s.semester}</span></td>
                                <td>
                                    <select className="premium-input" style={{ padding:'5px 10px', fontSize:12, width:190 }}
                                        value={s.faculty||''} disabled={updating===s.id}
                                        onChange={e=>patch(s.id,{faculty:e.target.value||null})}>
                                        <option value="">— Unassigned —</option>
                                        {faculties.map(f=><option key={f.id} value={f.id}>{f.user?.first_name} {f.user?.last_name}</option>)}
                                    </select>
                                </td>
                                <td>
                                    <button disabled={updating===s.id} onClick={()=>patch(s.id,{is_special:!s.is_special})}
                                        style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:700, fontSize:12,
                                            background: s.is_special?'rgba(245,158,11,.2)':'rgba(255,255,255,.05)',
                                            color: s.is_special?'#fbbf24':'var(--text-muted)' }}>
                                        {s.is_special?'★ Special':'☆ Normal'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!subjects.length && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-muted)', padding:28 }}>No subjects found. Add them in Subjects page.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN DASHBOARD
   ──────────────────────────────────────────────────────────────── */
export default function TimetableGADashboard() {
    const [tab, setTab] = useState('run');
    const [faculties, setFaculties] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [groups, setGroups] = useState([]);
    const [timetable, setTimetable] = useState([]);
    const [timeslots, setTimeslots] = useState([]);
    const [loading, setLoading] = useState(true);

    // GA state
    const [generating, setGenerating] = useState(false);
    const [progressVal, setProgressVal] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [reqId, setReqId] = useState(null);
    const [conflictScore, setConflictScore] = useState(null);
    const [constraintErrors, setConstraintErrors] = useState([]);
    const [gaError, setGaError] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [numGenerations, setNumGenerations] = useState(200);

    // Timetable view
    const [viewGroup, setViewGroup] = useState(null);
    const printRef = useRef(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [fR,sR,gR,ttR,tsR] = await Promise.all([
                api.get('/faculty/'),          // FacultyProfileViewSet at /api/faculty/
                api.get('/subjects/'),          // SubjectViewSet at /api/subjects/
                api.get('/class-groups/'),      // ClassGroupViewSet at /api/class-groups/
                api.get('/timetable/'),         // TimetableEntryViewSet at /api/timetable/
                api.get('/timeslots/'),         // TimeSlotViewSet at /api/timeslots/
            ]);
            setFaculties(fR.data.results||fR.data);
            setSubjects(sR.data.results||sR.data);
            const grps = gR.data.results||gR.data;
            setGroups(grps);
            if (grps.length && !viewGroup) setViewGroup(grps[0].id);
            setTimetable(ttR.data.results||ttR.data);
            setTimeslots(tsR.data.results||tsR.data);
        } catch(e){ console.error('fetchAll error:', e?.response?.data || e.message); }
        finally { setLoading(false); }
    },[]);

    useEffect(()=>{ fetchAll(); },[fetchAll]);

    /* polling */
    useEffect(()=>{
        let iv;
        if (generating && reqId) {
            iv = setInterval(async()=>{
                try {
                    const r = await api.get(`/timetable/progress/${reqId}/`);
                    const d=r.data;
                    setProgressVal(d.progress);
                    setProgressStatus(d.status.toUpperCase());
                    if (d.status==='completed') {
                        clearInterval(iv); setGenerating(false); setConflictScore(d.conflict_score); setReqId(null);
                        await fetchAll();
                        setTab('output'); // Auto-switch to output tab
                    } else if (d.status==='failed') {
                        clearInterval(iv); setGenerating(false); setReqId(null);
                        if (d.constraint_error?.length) { setConstraintErrors(d.constraint_error); setGaError(''); }
                        else { setGaError(d.error_message||'Generation failed.'); }
                    }
                } catch(_) {}
            }, 1200);
        }
        return ()=>clearInterval(iv);
    },[generating, reqId]);

    const runGA = async () => {
        setGenerating(true); setGaError(''); setConstraintErrors([]);
        setProgressVal(0); setProgressStatus('INITIALIZING'); setConflictScore(null);
        try {
            const payload = { num_generations: numGenerations, academic_year:'2025-26' };
            if (selectedGroupIds.length) payload.class_group_ids = selectedGroupIds;
            const r = await api.post('/timetable/generate/', payload);
            setReqId(r.data.request_id);
        } catch (err) {
            setGaError(err.response?.data?.detail||JSON.stringify(err.response?.data)||err.message);
            setGenerating(false);
        }
    };

    const handlePrint = () => {
        const el = printRef.current;
        if (!el) return;
        const w = window.open('','_blank','width=1100,height=800');
        w.document.write(`<html><head><title>Timetable</title><style>
            body{font-family:Arial,sans-serif;color:#000;background:#fff;margin:24px;}
            table{border-collapse:collapse;width:100%;}
            th,td{border:1px solid #333;padding:5px 7px;font-size:12px;text-align:center;}
            th{background:#e8e0ff;font-weight:700;}
        </style></head><body>${el.innerHTML}</body></html>`);
        w.document.close(); w.focus(); w.print();
    };

    /* data for the active timetable group */
    const activeGroupObj = groups.find(g=>g.id===viewGroup)||null;
    const groupEntries = timetable.filter(e=>e.class_group===viewGroup||e.class_group_name===activeGroupObj?.name);

    // Enrich subjects with faculty_name from faculties list
    const enrichedSubjects = useMemo(()=>subjects.map(s=>({
        ...s,
        faculty_name: s.faculty_name || (() => {
            const fp = faculties.find(f=>f.id===s.faculty);
            if (!fp) return '';
            const u = fp.user;
            return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
        })(),
    })),[subjects, faculties]);

    const TABS = [
        { id:'run', label:'⚡ Setup & Run' },
        { id:'mapping', label:'👥 Faculty Mapping' },
        { id:'output', label:'📋 Timetable Output' },
    ];

    return (
        <div>
            {/* ── Page Title ── */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
                <div>
                    <h1 style={{ fontSize:24, fontWeight:800, margin:'0 0 4px', fontFamily:'Outfit' }}>Timetable Generation Engine</h1>
                    <p style={{ color:'var(--text-secondary)', margin:0, fontSize:13 }}>
                        Multi-class conflict-free scheduling via Genetic Algorithm (PyGAD) · Department of {groups[0]?.department||'…'}
                    </p>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    {conflictScore!==null && !generating && (
                        <span style={{ fontSize:12, fontWeight:700, color:conflictScore>=0?'#34d399':'#fbbf24', display:'flex', alignItems:'center', gap:5 }}>
                            {conflictScore>=0?<><CheckCircle size={13}/> Zero Conflict</>:<><AlertTriangle size={13}/> Score:{conflictScore}</>}
                        </span>
                    )}
                    <button className="btn-secondary" onClick={fetchAll} style={{ padding:'8px 14px', fontSize:13 }}>
                        <RefreshCw size={13}/> Refresh
                    </button>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--border-subtle)', paddingBottom:1 }}>
                {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={tabStyle(tab===t.id)}>{t.label}</button>)}
            </div>

            {/* ════════════════ SETUP & RUN TAB ════════════════ */}
            {tab==='run' && (
                <div>
                    <ConstraintErrors errors={constraintErrors} onDismiss={()=>setConstraintErrors([])}/>
                    {gaError && <Alert type="error">{gaError}</Alert>}

                    {/* Class Groups config */}
                    <div style={{ marginBottom:24 }}>
                        <ClassGroupsPanel groups={groups} onRefresh={fetchAll}/>
                    </div>

                    {/* GA Params + Penalty reference */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
                        <div className="premium-card" style={{ padding:22 }}>
                            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                                <Settings size={15}/> Algorithm Parameters
                            </h3>
                            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                                <div>
                                    <label style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, display:'block', marginBottom:6 }}>Max Generations</label>
                                    <input className="premium-input" type="number" min={50} max={1000} step={50}
                                        value={numGenerations} onChange={e=>setNumGenerations(+e.target.value)}/>
                                </div>
                                <div>
                                    <label style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, display:'block', marginBottom:8 }}>
                                        Filter by Class Groups <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(leave empty = all)</span>
                                    </label>
                                    <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:140, overflowY:'auto' }}>
                                        {groups.length===0 && <span style={{ fontSize:12, color:'var(--text-muted)' }}>No classes added above yet.</span>}
                                        {groups.map(g=>(
                                            <label key={g.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--text-secondary)' }}>
                                                <input type="checkbox" checked={selectedGroupIds.includes(g.id)}
                                                    onChange={e=>setSelectedGroupIds(prev=>e.target.checked?[...prev,g.id]:prev.filter(x=>x!==g.id))}/>
                                                <span style={{ fontWeight:700, color:'#a78bfa' }}>{g.name}</span>
                                                <span style={{ fontSize:11, color:'var(--text-muted)' }}>— Sem {g.semester}{g.room_name?` · ${g.room_name}`:''}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button className="btn-primary" style={{ marginTop:20, width:'100%', justifyContent:'center', padding:13 }}
                                onClick={runGA} disabled={generating}>
                                {generating
                                    ? <><Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> {progressStatus} ({progressVal}%)</>
                                    : <><Zap size={15}/> Run Genetic Algorithm</>
                                }
                            </button>
                        </div>

                        <div className="premium-card" style={{ padding:22 }}>
                            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700 }}>Constraint Penalty Reference</h3>
                            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                                {[
                                    ['🚫','Faculty double-booking (same slot)','−1000','#fb7185'],
                                    ['🚫','Room double-booking','−1000','#fb7185'],
                                    ['🚫','Class double-booking','−1000','#fb7185'],
                                    ['🔒','Scheduled in locked slot','−1000','#fb7185'],
                                    ['⏰','Faculty exceeds max hrs/week','−1000','#fb7185'],
                                    ['📚','Library/Sports ≠ 2 days/week/class','−500','#fbbf24'],
                                    ['📆','>3 consecutive teaching periods','−200','#fbbf24'],
                                    ['⬜','Faculty free-period gap','−50','#94a3b8'],
                                    ['☀️','Morning period scheduled (P1–P3)','+50','#34d399'],
                                ].map(([icon,label,pts,color])=>(
                                    <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                                        <span style={{ color:'var(--text-secondary)' }}>{icon} {label}</span>
                                        <span style={{ fontWeight:700, color, fontFamily:'monospace', fontSize:13 }}>{pts}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {generating && (
                        <div className="premium-card" style={{ padding:22, marginBottom:20 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                                <span style={{ fontWeight:600, fontSize:14, color:'#a78bfa', display:'flex', alignItems:'center', gap:7 }}>
                                    <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>
                                    Evolving population — Generation ~{Math.round((progressVal/100)*numGenerations)}/{numGenerations}
                                </span>
                                <span style={{ fontWeight:700, fontSize:14, color:'#a78bfa' }}>{progressVal}%</span>
                            </div>
                            <div style={{ width:'100%', height:10, background:'rgba(255,255,255,.05)', borderRadius:5, overflow:'hidden' }}>
                                <div style={{ width:`${progressVal}%`, height:'100%', background:'linear-gradient(90deg,#7c3aed,#06b6d4)',
                                    borderRadius:5, transition:'width .8s ease', boxShadow:'0 0 14px rgba(124,58,237,.6)' }}/>
                            </div>
                            <p style={{ fontSize:11, color:'var(--text-muted)', margin:'8px 0 0' }}>
                                GA will auto-switch to Timetable Output when complete.
                            </p>
                        </div>
                    )}

                    <ConflictHeatmap score={conflictScore} running={generating} timetable={timetable} timeslots={timeslots}/>
                </div>
            )}

            {/* ════════════════ FACULTY MAPPING TAB ════════════════ */}
            {tab==='mapping' && (
                <FacultyMappingPanel faculties={faculties} subjects={enrichedSubjects} onRefresh={fetchAll}/>
            )}

            {/* ════════════════ TIMETABLE OUTPUT TAB ════════════════ */}
            {tab==='output' && (
                <div>
                    {/* Success banner */}
                    {conflictScore!==null && (
                        <Alert type={conflictScore>=0?'success':'warning'}>
                            {conflictScore>=0
                                ? <>✅ Zero-conflict timetable generated! Fitness score: <strong>{conflictScore}</strong>. All hard constraints satisfied.</>
                                : <>⚠️ GA completed with penalty score: <strong>{conflictScore}</strong>. Some conflicts may remain — try increasing Max Generations.</>
                            }
                        </Alert>
                    )}

                    {loading && <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}><Loader2 style={{animation:'spin 1s linear infinite'}}/></div>}

                    {!loading && groups.length===0 && (
                        <Alert type="warning">No class groups configured. Add them in the ⚡ Setup &amp; Run tab first, then run the GA.</Alert>
                    )}

                    {!loading && timeslots.filter(t=>!t.slot_label).length===0 && timeslots.length===0 && (
                        <Alert type="warning">No time slots configured. Add them via Admin → Time Slots.</Alert>
                    )}

                    {/* Class Group Tab Selector */}
                    {groups.length>0 && (
                        <>
                            <div style={{ display:'flex', gap:8, marginBottom:22, flexWrap:'wrap', alignItems:'center' }}>
                                <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, marginRight:4 }}>Class:</span>
                                {groups.map(g=>(
                                    <button key={g.id} onClick={()=>setViewGroup(g.id)}
                                        style={{ padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                                            background: viewGroup===g.id?'#7c3aed':'rgba(255,255,255,.07)',
                                            color: viewGroup===g.id?'#fff':'var(--text-secondary)', transition:'all .15s' }}>
                                        {g.name}
                                        <span style={{ fontSize:10, color:viewGroup===g.id?'rgba(255,255,255,.6)':'var(--text-muted)', marginLeft:6 }}>Sem {g.semester}</span>
                                    </button>
                                ))}
                                <button className="btn-secondary" style={{ padding:'8px 14px', fontSize:12, marginLeft:'auto' }} onClick={handlePrint}>
                                    <Printer size={13}/> Print / Export
                                </button>
                            </div>

                            {activeGroupObj && (
                                <div className="premium-card" style={{ padding:24 }}>
                                    <ClassicTimetableView
                                        group={activeGroupObj}
                                        entries={groupEntries}
                                        timeslots={timeslots}
                                        subjects={enrichedSubjects}
                                        printRef={printRef}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
