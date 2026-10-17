(() => {
  'use strict';
  const cfg = window.STORE_CONFIG || {};
  const configured = Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((cfg.supabaseUrl || '').trim()) && (cfg.supabasePublishableKey || '').trim());
  let client;
  const db = () => {
    if (!configured) return null;
    if (!window.supabase?.createClient) throw new Error('No se cargó Supabase.');
    if (!client) client = window.supabase.createClient(cfg.supabaseUrl.trim().replace(/\/$/, ''), cfg.supabasePublishableKey.trim());
    return client;
  };
  const money = n => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(Number(n) || 0);
  const date = d => new Date(d).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' });
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const orderCode = () => 'SV-' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const demoProducts = [
    { code:'vip', name:'VIP Mensual', description:'Rango de 30 días', category:'rangos', price_ars:3900, duration_days:30, max_quantity:1, badge:'', features:['Prefijo VIP y color de chat','3 homes','/craft y /hat','Kit semanal equilibrado'], delivery_type:'rank', rank_group:'vip', display_order:10, active:true },
    { code:'vipplus', name:'VIP+ Mensual', description:'Rango de 30 días', category:'rangos', price_ars:6000, duration_days:30, max_quantity:1, badge:'Destacado', features:['Todo lo de VIP','5 homes','Ender Chest y yunque portátil','Kit semanal mejorado','Cosméticos exclusivos','Vuelo en zonas habilitadas, fuera de combate'], delivery_type:'rank', rank_group:'vipplus', display_order:20, active:true },
    { code:'vip_semanal', name:'VIP Semanal', description:'Rango de 7 días', category:'rangos', price_ars:1200, duration_days:7, max_quantity:1, badge:'', features:['Prefijo VIP y color de chat','3 homes','/craft y /hat','Kit semanal equilibrado'], delivery_type:'rank', rank_group:'vip', display_order:30, active:true },
    { code:'vipplus_semanal', name:'VIP+ Semanal', description:'Rango de 7 días', category:'rangos', price_ars:1800, duration_days:7, max_quantity:1, badge:'', features:['Todo lo de VIP','5 homes','Ender Chest y yunque portátil','Kit semanal mejorado','Cosméticos exclusivos','Vuelo en zonas habilitadas, fuera de combate'], delivery_type:'rank', rank_group:'vipplus', display_order:40, active:true },
    { code:'fila_7d', name:'Espacios Mochila Semanal', description:'+9 espacios en la mochila', category:'mochilas', price_ars:500, duration_days:7, max_quantity:4, badge:'', features:['Una fila extra','Hasta 4 filas adicionales','Vigencia de 7 días'], delivery_type:'backpack', rank_group:null, display_order:50, active:true },
    { code:'fila_30d', name:'Espacios Mochila Mensual', description:'+9 espacios en la mochila', category:'mochilas', price_ars:1800, duration_days:30, max_quantity:4, badge:'', features:['Una fila extra','Hasta 4 filas adicionales','Vigencia de 30 días'], delivery_type:'backpack', rank_group:null, display_order:60, active:true },
  ];
  const productColumns = 'code,name,description,category,price_ars,duration_days,max_quantity,badge,features,active,display_order,delivery_type,rank_group';
  window.Store = { cfg, configured, db, money, date, esc, orderCode, demoProducts, productColumns };
})();
