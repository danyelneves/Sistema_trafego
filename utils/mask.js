module.exports = {
  maskPhone: (jid) => {
    if (!jid) return '';
    const clean = jid.toString().replace(/[^0-9]/g, '');
    return clean.substring(0, 6) + '***';
  },
  maskText: (text, max = 30) => {
    if (!text) return '';
    return text.substring(0, max) + (text.length > max ? '...' : '');
  },
  maskEmail: (email) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return local.substring(0, 3) + '***@' + domain;
  }
};
