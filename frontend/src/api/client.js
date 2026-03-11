import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auto-logout on 401
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refresh = localStorage.getItem('refresh_token');
                const res = await axios.post('/api/token/refresh/', { refresh });
                localStorage.setItem('access_token', res.data.access);
                original.headers.Authorization = `Bearer ${res.data.access}`;
                return api(original);
            } catch {
                localStorage.clear();
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);

export default api;
