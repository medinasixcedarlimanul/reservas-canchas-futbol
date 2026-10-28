/**
 * Auth Helper — Gestión de sesión, estado de usuario y guards de navegación.
 */
const auth = {
  getUser() {
    return api.getUser();
  },

  isAuthenticated() {
    return !!api.getToken() && !!this.getUser();
  },

  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    return data;
  },

  async register(clientData) {
    return await api.post('/auth/registro', clientData);
  },

  async logout() {
    try {
      await api.post('/auth/logout', {});
    } catch (e) {
      console.warn('Error durante logout en servidor:', e);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login.html';
    }
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  },

  requireRole(...rolesPermitidos) {
    this.requireAuth();
    const user = this.getUser();
    if (user.rol === 'superadmin') return;

    if (!rolesPermitidos.includes(user.rol)) {
      alert('No tienes permisos suficientes para acceder a este panel');
      window.location.href = '/index.html';
    }
  }
};
