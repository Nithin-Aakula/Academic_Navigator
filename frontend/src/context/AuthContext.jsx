import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.exp * 1000 > Date.now()) {
                    fetchMe();
                } else {
                    localStorage.clear();
                    setLoading(false);
                }
            } catch {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, []);

    const fetchMe = async () => {
        try {
            const res = await api.get('/users/me/');
            setUser(res.data);
        } catch {
            localStorage.clear();
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        const res = await api.post('/token/', { username, password });
        localStorage.setItem('access_token', res.data.access);
        localStorage.setItem('refresh_token', res.data.refresh);
        await fetchMe();
        return res.data;
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
