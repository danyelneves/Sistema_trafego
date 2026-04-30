(function() {
  const SCRIPT_VERSION = "1.0.0";
  // The backend API where the Pixel sends events
  const ENDPOINT = window.NEXUS_ENDPOINT || "https://sua-api.vercel.app/api/pixel/track";
  
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
  }

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get or Generate Visitor ID
  let visitorId = getCookie("_nexus_id");
  if (!visitorId) {
    visitorId = uuidv4();
    setCookie("_nexus_id", visitorId, 365); // 1 year tracking
  }

  // Extract UTMs
  const urlParams = new URLSearchParams(window.location.search);
  const utms = {
    source: urlParams.get('utm_source') || '',
    medium: urlParams.get('utm_medium') || '',
    campaign: urlParams.get('utm_campaign') || '',
    term: urlParams.get('utm_term') || '',
    content: urlParams.get('utm_content') || ''
  };

  const payload = {
    workspace_id: window.NEXUS_WORKSPACE_ID || 1, // Defined by user before loading script
    visitor_id: visitorId,
    url: window.location.href,
    referrer: document.referrer,
    utms: utms,
    event_type: 'page_view'
  };

  // Send Event
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(e => console.error("[Nexus Pixel] Error:", e));

  // Expose track function for custom events
  window.Nexus = {
    track: function(eventName, meta) {
      payload.event_type = eventName;
      payload.meta = meta || {};
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    },
    getVisitorId: () => visitorId
  };

  console.log(`[Nexus Pixel] Initialized v${SCRIPT_VERSION}. ID: ${visitorId}`);
})();
