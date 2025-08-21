import axios from 'axios'

// Create a base Axios instance pointing to Django backend via Vite proxy - KR 18/08/2025
const api = axios.create({ baseURL: '/api' });    

// Attach access token to every request if it exists in localStorage - KR 18/08/2025
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

//prevents multiple refresh requests - KR 21/08/2025
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject, original }) => {
    if (error) reject(error);
    else {
      original.headers.Authorization = `Bearer ${token}`;
      resolve(api(original));
    }
  });
  pendingQueue = [];
};

// Handle expired access tokens automatically - KR 19/08/2025
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;  

    // if request failed with 401 and hasn't already been retried - KR 19/08/2025
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;  // mark as retried

      // if another refresh request is already happening, queue this request - KR 21/08/2025
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject, original });
        });
      }

      isRefreshing = true;
      try {
        // grab refresh token from storage - KR 19/08/2025
        const refresh = localStorage.getItem("refresh");
        if (!refresh) throw new Error("No refresh token");

        // request a new access token from Django using the refresh token - KR 19/08/2025
        const { data } = await axios.post("/api/token/refresh/", { refresh });

        // save the new access token in localStorage - KR 20/08/2025
        localStorage.setItem("access", data.access);

        // attach new access token to the original request headers - KR 20/08/2025
        original.headers.Authorization = `Bearer ${data.access}`;

        // process all queued requests with new token - KR 20/08/2025
        processQueue(null, data.access);

        // retry the original request with the new token - KR 20/08/2025
        return api(original);

      } catch (e) {
        // refresh failed (expired/invalid) - force logout - KR 20/08/2025
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");

        // fail all queued requests too - KR 20/08/2025
        processQueue(e, null);

        // redirect only if not already on login page - KR 20/08/2025
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      } finally {
        isRefreshing = false; // allow future refresh attempts - KR 20/08/2025
      }
    }
    // any other error - reject - KR 20/08/2025
    return Promise.reject(error);
  }
);

export default api;