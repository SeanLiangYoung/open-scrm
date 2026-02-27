import axios from 'axios';

const api = axios.create({ baseURL: '', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data === 'object' && (data.code === 200 || data.success === true) && data.data !== undefined) {
      response.data = data.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
