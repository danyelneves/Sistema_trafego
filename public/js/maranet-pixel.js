/**
 * Maranet Pixel - Server-Side Tracking
 */
(function(window, document) {
  if (window.maranetInit) return;
  window.maranetInit = true;

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
    for(let i=0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  }

  // Persist UTMs and click IDs
  const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  let currentUtms = {};
  utms.forEach(u => {
    let val = getQueryParam(u);
    if (val) {
      setCookie('maranet_' + u, val, 30); // 30 days
      currentUtms[u] = val;
    } else {
      currentUtms[u] = getCookie('maranet_' + u);
    }
  });

  window.maranet = function(action, eventType, data = {}) {
    if (action === 'init') {
      CONFIG.workspaceId = eventType; // maranet('init', '1')
      // Auto-detect the API URL based on where this script is loaded from
      const scripts = document.getElementsByTagName('script');
      for (let s of scripts) {
        if (s.src && s.src.includes('maranet-pixel.js')) {
          const url = new URL(s.src);
          CONFIG.apiUrl = url.origin + '/api/pixel';
        }
      }
      return;
    }
    if (action === 'track') {
      if (!CONFIG.workspaceId) return console.error('Maranet Pixel: workspace não inicializado.');
      
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
      }).catch(e => console.error('Maranet Pixel Error:', e));
    }
  };

  // Process queue if any (e.g., snippet added before script loaded)
  if (window.maranetQueue && window.maranetQueue.length) {
    window.maranetQueue.forEach(args => window.maranet.apply(null, args));
    window.maranetQueue = [];
  }

})(window, document);
