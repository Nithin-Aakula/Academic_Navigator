import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TimetableGrid from '../components/TimetableGrid';
import ClassModeWebcam from '../components/ClassModeWebcam';
import api from '../api/client';
import {
    LayoutDashboard, Users, Calendar, AlertTriangle,
    Camera, UploadCloud, ClipboardCheck, BookOpen
} from 'lucide-react';

export default function FacultyDashboard() {
    const navItems = [
        { to: '/faculty/home', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/faculty/attendance', icon: Camera, label: 'Attendance Hub' },
        { to: '/faculty/timetable', icon: Calendar, label: 'Timetables' },
        { to: '/faculty/marks', icon: UploadCloud, label: 'Upload Marks' },
        { to: '/faculty/complaints', icon: AlertTriangle, label: 'Complaints' },
    ];

    return (
        <div className="app-container">
            <Sidebar navItems={navItems} />
            <main className="main-content">
                <Routes>
                    <Route path="home" element={<FacultyHome />} />
                    <Route path="attendance" element={<AttendanceHub />} />
                    <Route path="timetable" element={<FacultyTimetable />} />
                    <Route path="marks" element={<div className="premium-card"><h2>Marks Upload (Coming Soon)</h2></div>} />
                    <Route path="complaints" element={<FacultyComplaints />} />
                    <Route path="*" element={<Navigate to="home" replace />} />
                </Routes>
            </main>
        </div>
    );
}

function FacultyHome() {
    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Faculty Overview</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Welcome back. Here is your daily digest.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                <div className="premium-card">
                    <p className="kpi-title"><Users size={16} /> Students Taught</p>
                    <p className="kpi-value">120</p>
                </div>
                <div className="premium-card">
                    <p className="kpi-title"><BookOpen size={16} /> Classes Today</p>
                    <p className="kpi-value">3</p>
                </div>
                <div className="premium-card">
                    <p className="kpi-title"><AlertTriangle size={16} /> Pending Complaints</p>
                    <p className="kpi-value" style={{ color: 'var(--accent-rose)' }}>2</p>
                </div>
            </div>
        </div>
    );
}

function AttendanceHub() {
    const [activeTab, setActiveTab] = useState('capture');

    return (
        <div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <button
                    className={activeTab === 'capture' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('capture')}
                >
                    Class Mode (Live FR)
                </button>
                <button
                    className={activeTab === 'enroll' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('enroll')}
                >
                    Enroll Student Face
                </button>
            </div>

            <div className="premium-card">
                {activeTab === 'capture' ? <ClassModeWebcam /> : <FaceEnrollment />}
            </div>
        </div>
    );
}

function FaceEnrollment() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [stream, setStream] = useState(null);

    useEffect(() => {
        api.get('/users/students/').then(res => setStudents(res.data)).catch(console.error);
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [stream]);

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = s;
            setStream(s);
        } catch (err) {
            console.error(err);
            setMessage('Camera access denied.');
        }
    };

    const captureAndEnroll = async () => {
        if (!selectedStudent || !videoRef.current) return;
        setLoading(true);
        setMessage('');

        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        const frameBase64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];

        try {
            const res = await api.post('/attendance/enroll/', {
                student_id: selectedStudent,
                frame: frameBase64
            });
            setMessage(res.data.detail || 'Successfully enrolled face.');
        } catch (err) {
            setMessage(err.response?.data?.detail || 'Failed to enroll face.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Enroll Face</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Capture a high-quality photograph of a student to save their face encoding to the database.</p>

            <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                    <select
                        className="premium-input"
                        value={selectedStudent}
                        onChange={e => setSelectedStudent(e.target.value)}
                        style={{ marginBottom: '16px' }}
                    >
                        <option value="">-- Select Student --</option>
                        {students.map(s => (
                            <option key={s.id} value={s.id}>{s.student_id} - {s.user.first_name} {s.user.last_name}</option>
                        ))}
                    </select>

                    <div className="webcam-feed-container" style={{ height: '300px', marginBottom: '16px' }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {!stream && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <button className="btn-secondary" onClick={startCamera}>Enable Camera</button>
                            </div>
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>

                    <button
                        className="btn-primary"
                        onClick={captureAndEnroll}
                        disabled={!stream || !selectedStudent || loading}
                    >
                        {loading ? 'Processing...' : 'Capture & Enroll'}
                    </button>

                    {message && <p style={{ marginTop: '16px', color: message.includes('Failed') ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{message}</p>}
                </div>
                <div style={{ flex: 1 }}>
                    <div className="premium-card">
                        <h3>Instructions</h3>
                        <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Ensure the student is well-lit and facing the camera directly.</li>
                            <li>Remove glasses or hats if possible.</li>
                            <li>Click "Capture & Enroll" when ready. It may take a few seconds to process.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FacultyTimetable() {
    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>My Timetable</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>View your scheduled classes for the week. This is synchronized automatically by the administration.</p>
            <TimetableGrid />
        </div>
    );
}

function FacultyComplaints() {
    const [complaints, setComplaints] = useState([]);

    const fetchComplaints = () => {
        api.get('/academics/complaints/').then(res => setComplaints(res.data)).catch(console.error);
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    const resolveComplaint = async (id) => {
        try {
            await api.patch(`/academics/complaints/${id}/`, { status: 'resolved' });
            fetchComplaints();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Department Complaints</h1>
            <div className="premium-table-container">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Complaint</th>
                            <th>Resolved By</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {complaints.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No complaints found.</td></tr>
                        ) : complaints.map(c => (
                            <tr key={c.id}>
                                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                                <td>
                                    <span className={`badge ${c.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>
                                        {c.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ maxWidth: '300px' }}>{c.body}</td>
                                <td>{c.resolved_by_name || '-'}</td>
                                <td>
                                    {c.status !== 'resolved' && (
                                        <button className="btn-secondary" onClick={() => resolveComplaint(c.id)}>Mark Resolved</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
