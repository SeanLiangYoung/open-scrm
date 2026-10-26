import axios from 'axios';

const api = axios.create({ baseURL: '', timeout: 15000 });

// Bind errors to the session that actually sent the request. A fresh login can
// receive an identical JWT within one signing second, so token equality alone
// cannot identify responses from a previous login.
let sessionGeneration = 0;
let latestLoginRequest = 0;
const requestSessions = new WeakMap<
  object,
  { token: string | null; generation: number; loginAttempt?: number }
>();
const isLogin = (url?: string) => url?.split('?')[0] === '/api/v1/auth/login';

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  requestSessions.set(config, {
    token,
    generation: sessionGeneration,
    ...(isLogin(config.url) ? { loginAttempt: ++latestLoginRequest } : {})
  });
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => {
    const data = response.data;
    if (
      data &&
      typeof data === 'object' &&
      (data.code === 200 || data.success === true) &&
      data.data !== undefined
    ) {
      response.data = data.data;
    }
    if (
      isLogin(response.config?.url) &&
      requestSessions.get(response.config)?.loginAttempt === latestLoginRequest &&
      typeof response.data?.accessToken === 'string'
    ) {
      sessionGeneration++;
    }
    return response;
  },
  error => {
    const requestSession = error.config && requestSessions.get(error.config);
    const belongsToCurrentSession =
      requestSession &&
      requestSession.generation === sessionGeneration &&
      requestSession.token === localStorage.getItem('token');
    if (error.response?.status === 401 && !isLogin(error.config?.url) && belongsToCurrentSession) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
