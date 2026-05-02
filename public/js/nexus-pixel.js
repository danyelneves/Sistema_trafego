/**
 * Nexus Pixel — Server-Side Tracking
 *
 * Snippet:
 *   <script async src="https://nexusagencia.app/js/nexus-pixel.js"></script>
 *   <script>
 *     window.nexusQueue = window.nexusQueue || [];
 *     function nexus(){ nexusQueue.push(arguments); }
 *     nexus('init', '<WORKSPACE_ID>');
 *     nexus('track', 'pageview');
 *   </script>
 */
(function(window, document) {
  if (window.nexusInit) return;
  window.nexusInit = true;

  const CONFIG = {
    workspaceId: null,
    apiUrl: ''
  };

  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      let date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
  }

  function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // Persist UTMs and click IDs (cookie prefix: nx_)
  const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  let currentUtms = {};
  utms.forEach(u => {
    let val = getQueryParam(u);
    if (val) {
      setCookie('nx_' + u, val, 30);
      currentUtms[u] = val;
    } else {
      currentUtms[u] = getCookie('nx_' + u);
    }
  });

  window.nexus = function(action, eventType, data = {}) {
    if (action === 'init') {
      CONFIG.workspaceId = eventType;
      const scripts = document.getElementsByTagName('script');
      for (let s of scripts) {
        if (s.src && s.src.includes('nexus-pixel.js')) {
          const url = new URL(s.src);
          CONFIG.apiUrl = url.origin + '/api/pixel';
        }
      }
      return;
    }
    if (action === 'track') {
      if (!CONFIG.workspaceId) return console.error('Nexus Pixel: workspace não inicializado.');

      const payload = {
        workspace_id: CONFIG.workspaceId,
        event_type: eventType,
        url: window.location.href,
        utms: currentUtms,
        data: data
      };

      fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors'
      }).catch(e => console.error('Nexus Pixel Error:', e));
    }
  };

  if (window.nexusQueue && window.nexusQueue.length) {
    window.nexusQueue.forEach(args => window.nexus.apply(null, args));
    window.nexusQueue = [];
  }

})(window, document);
