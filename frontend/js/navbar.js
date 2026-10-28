/**
 * Navbar — Renderizado dinámico de la barra de navegación según el rol y sesión.
 */
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
});

function renderNavbar() {
  const navContainer = document.getElementById('navbar-slot');
  if (!navContainer) return;

  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();
  const currentPath = window.location.pathname;

  let linksHtml = `
    <li><a href="/index.html" class="nav-link ${currentPath.endsWith('index.html') || currentPath === '/' ? 'active' : ''}">Inicio</a></li>
    <li><a href="/canchas.html" class="nav-link ${currentPath.endsWith('canchas.html') ? 'active' : ''}">Canchas</a></li>
    <li><a href="/reservar.html" class="nav-link ${currentPath.endsWith('reservar.html') ? 'active' : ''}">Reservar</a></li>
  `;

  if (isAuth) {
    if (user.rol === 'cliente') {
      linksHtml += `
        <li><a href="/mis-reservas.html" class="nav-link ${currentPath.endsWith('mis-reservas.html') ? 'active' : ''}">Mis Reservas</a></li>
      `;
    }

    if (user.rol === 'recepcionista' || user.rol === 'admin' || user.rol === 'superadmin') {
      linksHtml += `
        <li><a href="/recepcion.html" class="nav-link ${currentPath.endsWith('recepcion.html') ? 'active' : ''}">Recepción & Caja</a></li>
      `;
    }

    if (user.rol === 'admin' || user.rol === 'superadmin') {
      linksHtml += `
        <li><a href="/admin.html" class="nav-link ${currentPath.endsWith('admin.html') ? 'active' : ''}">Administración</a></li>
      `;
    }
  }

  let userSectionHtml = '';
  if (isAuth) {
    userSectionHtml = `
      <div class="nav-user">
        <span class="badge ${user.rol === 'admin' || user.rol === 'superadmin' ? 'badge-danger' : user.rol === 'recepcionista' ? 'badge-warning' : 'badge-success'}">
          ${user.rol}
        </span>
        <span style="font-size: 0.9rem; font-weight: 600;">${user.nombre}</span>
        <button onclick="auth.logout()" class="btn btn-secondary btn-sm">Salir</button>
      </div>
    `;
  } else {
    userSectionHtml = `
      <div class="nav-user">
        <a href="/login.html" class="btn btn-secondary btn-sm">Iniciar Sesión</a>
        <a href="/registro.html" class="btn btn-primary btn-sm">Registrarse</a>
      </div>
    `;
  }

  navContainer.innerHTML = `
    <nav class="navbar">
      <div class="navbar-container">
        <a href="/index.html" class="brand-logo">
          ⚡ SportReserve
          <span class="brand-badge">Multi-Negocio</span>
        </a>
        <ul class="nav-links">
          ${linksHtml}
        </ul>
        ${userSectionHtml}
      </div>
    </nav>
  `;
}
