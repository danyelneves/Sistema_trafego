/**
 * sidebar.js — renderiza a sidebar do NEXUS OS em qualquer página.
 *
 * Uso:
 *   <aside id="sidebar" data-active="sentinel"></aside>
 *   <script src="/js/sidebar.js"></script>
 *
 * Marca o nav-item correto como ativo via data-active.
 */
(function() {
  const ICONS = {
    dashboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    services: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
    traffic: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16V9"/><path d="M11 16V5"/><path d="M15 16v-3"/><path d="M19 16v-7"/></svg>',
    sentinel: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-8 8.5-4.5-1-8-3.5-8-8.5V6l8-3 8 3z"/><path d="m9 12 2 2 4-4"/></svg>',
    launcher: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>',
    lazarus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    skynet: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    doppelganger: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    forge: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/><path d="m14 7 3 3"/></svg>',
    studio: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    vending: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    market: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/></svg>',
    franchise: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h18"/><path d="M6 18V11"/><path d="M10 18V11"/><path d="M14 18V11"/><path d="M18 18V11"/><path d="M3 11h18l-2-7H5l-2 7Z"/></svg>',
    billing: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    empire: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v11"/><path d="M12 5v6"/><path d="M18 5v14"/><rect width="20" height="20" x="2" y="2" rx="2"/></svg>',
    poltergeist: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>',
    titan: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>',
    hive: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>',
    audit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
    logout:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  };

  const NAV_GROUPS = [
    { label: 'Principal', items: [
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', href: '/app' },
      { id: 'services', icon: 'services', label: 'Services', href: '/services' },
    ]},
    { label: 'Tráfego & Vendas', items: [
      { id: 'traffic', icon: 'traffic', label: 'Tráfego pago', href: '/traffic' },
      { id: 'sentinel', icon: 'sentinel', label: 'Sentinel', href: '/sentinel' },
      { id: 'launcher', icon: 'launcher', label: 'Launcher', href: '/launcher' },
      { id: 'lazarus', icon: 'lazarus', label: 'Lázaro', href: '/lazarus' },
    ]},
    { label: 'IA & Vendas', items: [
      { id: 'skynet', icon: 'skynet', label: 'Skynet', href: '/skynet' },
      { id: 'doppelganger', icon: 'doppelganger', label: 'Doppelgänger', href: '/doppelganger' },
      { id: 'forge', icon: 'forge', label: 'Forge', href: '/forge' },
      { id: 'studio', icon: 'studio', label: 'Studio', href: '/studio' },
    ]},
    { label: 'Receita', items: [
      { id: 'vending', icon: 'vending', label: 'Vending', href: '/vending' },
      { id: 'market', icon: 'market', label: 'Market', href: '/market' },
      { id: 'franchise', icon: 'franchise', label: 'Franchise', href: '/franchise' },
      { id: 'billing', icon: 'billing', label: 'Billing', href: '/billing' },
    ]},
    { label: 'Operacional', items: [
      { id: 'empire', icon: 'empire', label: 'Empire', href: '/empire' },
      { id: 'poltergeist', icon: 'poltergeist', label: 'Poltergeist', href: '/poltergeist' },
      { id: 'titan', icon: 'titan', label: 'Titan', href: '/titan' },
      { id: 'hive', icon: 'hive', label: 'Hive', href: '/hive' },
      { id: 'audit', icon: 'audit', label: 'Audit Log', href: '/audit' },
    ]},
  ];

  function renderSidebar(activeId) {
    const aside = document.getElementById('sidebar');
    if (!aside) return;
    let html = `
      <div class="brand">
        <h1>NEXUS<span>·</span>OS</h1>
        <div class="v">COMMAND CENTER</div>
      </div>
    `;
    NAV_GROUPS.forEach(group => {
      html += `<div class="nav-section"><div class="nav-label">${group.label}</div>`;
      group.items.forEach(item => {
        const active = item.id === activeId ? ' active' : '';
        const icon = ICONS[item.icon] || '';
        html += `<a href="${item.href}" class="nav-item${active}"><span class="nav-icon">${icon}</span>${item.label}</a>`;
      });
      html += `</div>`;
    });
    html += `
      <div class="nav-section" style="margin-top:auto;">
        <div class="nav-label">Conta</div>
        <a href="#" id="btn-logout" class="nav-item"><span class="nav-icon">${ICONS.logout}</span>Sair</a>
      </div>
    `;
    aside.innerHTML = html;
    document.getElementById('btn-logout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/login';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const aside = document.getElementById('sidebar');
    if (aside) renderSidebar(aside.dataset.active);
  });

  window.NEXUS_SIDEBAR = { render: renderSidebar };
})();
