/**
 * Global axios interceptor — attaches X-User-Id and X-User-Phone headers
 * from localStorage `foodkey_user` to every request. Backend uses these for
 * lightweight role-based auth on guarded endpoints.
 *
 * Imported once from index.js so it runs before any component mounts.
 */
import axios from 'axios';

axios.interceptors.request.use(
    (config) => {
        try {
            const raw = localStorage.getItem('foodkey_user');
            if (raw) {
                const user = JSON.parse(raw);
                if (user?.id) {
                    config.headers['X-User-Id'] = user.id;
                }
                if (user?.phone) {
                    config.headers['X-User-Phone'] = user.phone;
                }
            }
        } catch (_) {
            // ignore — proceed with no auth headers
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default axios;
