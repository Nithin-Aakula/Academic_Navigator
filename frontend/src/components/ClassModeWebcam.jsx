import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { Camera, CameraOff, Loader2, UserCheck, AlertCircle } from 'lucide-react';

export default function ClassModeWebcam() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [active, setActive] = useState(false);
    const [recognized, setRecognized] = useState([]);
    const [subjectId, setSubjectId] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('idle'); // idle | starting | running | stopped
    const streamRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        api.get('/subjects/').then(r => setSubjects(r.data.results || r.data)).catch(() => { });
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        setError('');
        setStatus('starting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setActive(true);
            setStatus('running');
            // Send frame every 2 seconds
            intervalRef.current = setInterval(captureAndSend, 2000);
        } catch (err) {
            setError('Camera access denied or not available: ' + err.message);
            setStatus('idle');
        }
    };

    const stopCamera = () => {
        clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setActive(false);
        setStatus('stopped');
    };

    const captureAndSend = async () => {
        if (!videoRef.current || !canvasRef.current || !subjectId) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        try {
            const res = await api.post('/attendance/frame/', {
                frame: base64,
                subject_id: parseInt(subjectId),
            });
            const newRec = res.data.recognized || [];
            if (newRec.length > 0) {
                setRecognized(prev => {
                    const existingIds = new Set(prev.map(r => r.student_id));
                    const fresh = newRec.filter(r => !existingIds.has(r.student_id));
                    return [...prev, ...fresh];
                });
            }
        } catch { }
    };

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Class Mode — Facial Recognition Attendance</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>Webcam captures frames every 2s and automatically marks attendance via face recognition.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
                {/* Webcam */}
                <div>
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select
                            className="an-input"
                            value={subjectId}
                            onChange={e => setSubjectId(e.target.value)}
                            style={{ maxWidth: '240px' }}
                        >
                            <option value="">Select Subject…</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                        </select>
                        {!active ? (
                            <button className="btn-primary" onClick={startCamera} disabled={!subjectId || status === 'starting'}>
                                {status === 'starting' ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Starting…</> : <><Camera size={14} /> Start Class Mode</>}
                            </button>
                        ) : (
                            <button className="btn-secondary" onClick={stopCamera}>
                                <CameraOff size={14} /> Stop
                            </button>
                        )}
                    </div>

                    {error && <div className="alert-banner alert-danger" style={{ marginBottom: '16px' }}><AlertCircle size={14} /> {error}</div>}

                    <div className="webcam-ring" style={{ overflow: 'hidden', position: 'relative', background: 'var(--navy-card)' }}>
                        <video
                            ref={videoRef}
                            style={{ width: '100%', borderRadius: '10px', display: 'block', minHeight: '300px', objectFit: 'cover' }}
                            muted
                            playsInline
                        />
                        {!active && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                                <Camera size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a subject and click Start</p>
                            </div>
                        )}
                        {active && (
                            <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(244,63,94,0.9)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'blink 1s steps(1) infinite', display: 'inline-block' }} />
                                LIVE
                            </div>
                        )}
                    </div>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                {/* Recognized list */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Recognized Students</h3>
                        {recognized.length > 0 && (
                            <button className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setRecognized([])}>Clear</button>
                        )}
                    </div>
                    <div className="glass-card" style={{ padding: '16px', minHeight: '300px' }}>
                        {recognized.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                                <UserCheck size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                <p style={{ margin: 0, fontSize: '13px' }}>Waiting for faces…</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {recognized.map((r, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', animation: 'slideDown 0.3s ease' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px', fontWeight: 700, color: 'white' }}>
                                            {r.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{r.name}</p>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#34d399' }}>✓ Present · {r.student_id}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                        {recognized.length} student{recognized.length !== 1 ? 's' : ''} marked present
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
