(function () {
  'use strict';
  const PRODUCTS = Object.freeze({
    fila_7d: { name: 'Fila extra · Semanal', label: '1 fila adicional por 7 días', price: 500, duration: '7 días', days: 7, kind: 'backpack', maxQuantity: 4 },
    fila_30d: { name: 'Fila extra · Mensual', label: '1 fila adicional por 30 días', price: 1800, duration: '30 días', days: 30, kind: 'backpack', maxQuantity: 4 },
    vip: { name: 'Rango VIP', label: 'Beneficios VIP por 30 días', price: 2200, duration: '30 días', days: 30, kind: 'rank', maxQuantity: 1 },
    vipplus: { name: 'Rango VIP+', label: 'Beneficios VIP+ por 30 días', price: 3900, duration: '30 días', days: 30, kind: 'rank', maxQuantity: 1 },
  });
  const cfg = window.STORE_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(cfg.supabaseUrl.trim()));
  let client = null;
  function db() {
    if (!configured) return null;
    if (!window.supabase?.createClient) throw new Error('No se pudo cargar Supabase. Revisá tu conexión a internet.');
    if (!client) client = window.supabase.createClient(cfg.supabaseUrl.trim().replace(/\/$/, ''), cfg.supabasePublishableKey.trim());
    return client;
  }
  const formatMoney = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const formatDate = (s) => new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const randomCode = () => { const data = crypto.getRandomValues(new Uint8Array(5)); return 'SV-' + [...data].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const transferAlias = cfg.paymentAlias || 'dev.cristianm.mp';
  window.Store = { PRODUCTS, cfg, configured, db, formatMoney, formatDate, escapeHtml, randomCode, transferAlias };
})();
