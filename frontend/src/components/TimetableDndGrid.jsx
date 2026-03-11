import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loader2, Zap, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const SUBJECT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0284c7', '#059669'];

export default function TimetableDndGrid() {
    const { user } = useAuth();
    const [timetable, setTimetable] = useState([]);
    const [timeslots, setTimeslots] = useState([]);

    // Polling states
    const [generating, setGenerating] = useState(false);
    const [progressStr, setProgressStr] = useState('');
    const [progressVal, setProgressVal] = useState(0);
    const [reqId, setReqId] = useState(null);

    const [error, setError] = useState('');
    const [meta, setMeta] = useState(null);

    const fetchTimetable = async () => {
        try {
            const [ttRes, tsRes] = await Promise.all([
                api.get('/timetable/'),
                api.get('/timeslots/')
            ]);

            setTimetable(ttRes.data.results || ttRes.data);
            setTimeslots(tsRes.data.results || tsRes.data);
        } catch (err) {
            setError('Failed to load constraints from database.');
        }
    };

    useEffect(() => {
        fetchTimetable();
    }, []);

    // Polling Logic
    useEffect(() => {
        let interval;
        if (generating && reqId) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get(`/timetable/progress/${reqId}/`);
                    setProgressVal(res.data.progress);
                    setProgressStr(res.data.status.toUpperCase() + ' (' + res.data.progress + '%)');

                    if (res.data.status === 'completed') {
                        clearInterval(interval);
                        setGenerating(false);
                        setMeta({ conflictScore: res.data.conflict_score });
                        setReqId(null);
                        fetchTimetable(); // Refresh grid
                    } else if (res.data.status === 'failed') {
                        clearInterval(interval);
                        setGenerating(false);
                        setError(res.data.error_message || 'Generation failed.');
                        setReqId(null);
                    }
                } catch (e) {
                    // Ignore transient errors
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [generating, reqId]);

    const generate = async () => {
        setGenerating(true);
        setError('');
        setProgressVal(0);
        setProgressStr('INITIALIZING...');
        try {
            const res = await api.post('/timetable/generate/', {});
            setReqId(res.data.request_id);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to start Generation.');
            setGenerating(false);
        }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;

        const sourceId = result.source.droppableId;
        const destId = result.destination.droppableId;
        const entryId = result.draggableId;

        if (sourceId === destId) return; // Dropped in same cell

        try {
            // Predict optimistic UI update
            const newTsId = parseInt(destId.replace('slot-', ''));
            const entryObj = timetable.find(e => e.id.toString() === entryId.toString());
            const newTsObj = timeslots.find(t => t.id === newTsId);

            // Ask API to validate and commit simultaneously
            const res = await api.post('/timetable/validate_move/', {
                entry_id: entryObj.id,
                new_timeslot_id: newTsId,
                commit: true
            });

            if (res.data.valid) {
                // Update UI locally
                setTimetable(prev => prev.map(e => {
                    if (e.id === entryObj.id) {
                        return {
                            ...e,
                            timeslot: newTsObj,
                            day: newTsObj.day,
                            day_name: newTsObj.day_name,
                            period: newTsObj.period,
                        };
                    }
                    return e;
                }));
            } else {
                alert('Invalid Move: ' + res.data.reason);
            }
        } catch (e) {
            alert('Server rejected move. ' + (e.response?.data?.reason || e.message));
        }
    };

    // Prepare grid layout logic
    const periods = [...new Set(timeslots.map(t => t.period))].sort((a, b) => a - b);
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Control Room</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
                        Drag and drop items to manually tune the CSP heuristic algorithm
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={fetchTimetable} disabled={generating}>
                        <RefreshCw size={15} /> Refresh Data
                    </button>
                    <button className="btn-primary" onClick={generate} disabled={generating}>
                        {generating ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {progressStr}</> : <><Zap size={15} /> Run CSP AI</>}
                    </button>
                </div>
            </div>

            {generating && (
                <div className="premium-card" style={{ padding: '40px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>Algorithm Running...</span>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--violet-light)' }}>{progressVal}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressVal}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #06b6d4)', transition: 'width 0.5s ease' }} />
                    </div>
                </div>
            )}

            {error && (
                <div className="alert-banner alert-danger" style={{ marginBottom: '20px' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {meta && (
                <div className="alert-banner alert-success" style={{ marginBottom: '20px' }}>
                    <CheckCircle size={16} /> Generation Complete with Conflict Score: <strong>{meta.conflictScore}</strong>
                </div>
            )}

            {!generating && timeslots.length > 0 && (
                <div className="premium-card" style={{ padding: '20px', overflowX: 'auto' }}>
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${periods.length}, 1fr)`, gap: '6px', minWidth: '800px' }}>
                            {/* Header */}
                            <div className="tt-header-v2" style={{ background: 'transparent' }}>Day / Period</div>
                            {periods.map(p => {
                                const sample = timeslots.find(t => t.period === p);
                                return (
                                    <div key={p} className="tt-header-v2">
                                        P{p} <span style={{ display: 'block', fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>{sample?.start_time.slice(0, 5)}</span>
                                    </div>
                                );
                            })}

                            {/* Grid Body */}
                            {DAYS.map((dayName, dIdx) => (
                                <div style={{ display: 'contents' }} key={dIdx}>
                                    <div className="tt-header-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {dayName}
                                    </div>
                                    {periods.map(p => {
                                        const tsObj = timeslots.find(t => t.day === dIdx && t.period === p);
                                        const tsIdStr = tsObj ? `slot-${tsObj.id}` : `dummy-${dIdx}-${p}`;

                                        // Items falling in this droppable cell
                                        const items = tsObj ? timetable.filter(e => e.timeslot?.id === tsObj.id) : [];

                                        return (
                                            <Droppable droppableId={tsIdStr} key={tsIdStr}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className="tt-cell-v2"
                                                        style={{
                                                            minHeight: '80px',
                                                            background: tsObj?.is_locked ? 'rgba(255,0,0,0.05)' : snapshot.isDraggingOver ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                                            border: tsObj?.is_locked ? '1px dashed rgba(255,0,0,0.4)' : snapshot.isDraggingOver ? '1px dashed #7c3aed' : '1px solid transparent',
                                                            display: 'flex', flexDirection: 'column', gap: '4px'
                                                        }}
                                                    >
                                                        {tsObj?.is_locked && <span style={{ fontSize: '10px', color: 'var(--accent-rose)', alignSelf: 'center' }}>LOCKED</span>}

                                                        {items.map((entry, idx) => {
                                                            const color = SUBJECT_COLORS[entry.subject.id % SUBJECT_COLORS.length];
                                                            return (
                                                                <Draggable key={entry.id.toString()} draggableId={entry.id.toString()} index={idx}>
                                                                    {(dragProv, dragSnap) => (
                                                                        <div
                                                                            ref={dragProv.innerRef}
                                                                            {...dragProv.draggableProps}
                                                                            {...dragProv.dragHandleProps}
                                                                            style={{
                                                                                ...dragProv.draggableProps.style,
                                                                                background: `${color}18`,
                                                                                border: `1px solid ${color}40`,
                                                                                color: color,
                                                                                padding: '6px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '11px',
                                                                                boxShadow: dragSnap.isDragging ? '0 8px 24px rgba(0,0,0,0.6)' : 'none',
                                                                                opacity: dragSnap.isDragging ? 0.9 : 1
                                                                            }}
                                                                        >
                                                                            <strong style={{ display: 'block' }}>{entry.subject.code}</strong>
                                                                            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>Room: {entry.room.name}</span>
                                                                            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>{entry.faculty.user.first_name} {entry.faculty.user.last_name}</span>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            );
                                                        })}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </DragDropContext>
                </div>
            )}
        </div>
    );
}
