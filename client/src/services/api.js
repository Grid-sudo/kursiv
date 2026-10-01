export async function api(path, options = {}) {
  const token = localStorage.getItem('course-token');
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token && path !== '/auth/login') window.dispatchEvent(new Event('course-auth-expired'));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие');
  return data;
}

export const setToken = token => token ? localStorage.setItem('course-token', token) : localStorage.removeItem('course-token');
export const hasToken = () => !!localStorage.getItem('course-token');

export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });
export const remove = path => api(path, { method: 'DELETE' });
export const uploadFile = file => {
  const form = new FormData();
  form.append('file', file);
  return api('/upload', { method: 'POST', body: form });
};
