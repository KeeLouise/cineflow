import axios from 'axios'
const api = axios.create({ baseURL: '/api' //Vite dev proxy forwards to Django. KR 18/08/2025    
});

// attach access token if present. KR 18/08/2025
api.interceptors.request.use((config) =>
{
    const token = localStorage.getItem("access");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

//If request turns 401, try to refresh once, then retry the original. KR 18/08/2025
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refresh = localStorage.getItem("refresh");
                if (!refresh) throw new Error("No refresh token");

                const { data } = await axios.post("/api/token/refresh/", { refresh });
                localStorage.setItem("access", data.access);

                original.headers.Authorization = `Bearer ${data.access}`;
                return api(original); //retry original request with new token - KR 18/08/2025
              } catch (e) {
                // refresh failed -> logout and redirect - KR 18/08/2025
                localStorage.removeItem("access");
                localStorage.removeItem("refresh");
                window.location.href = "/login";
              }
        }
        return Promise.reject(error);
    }
);

export default api;
