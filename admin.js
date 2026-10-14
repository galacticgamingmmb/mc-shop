(() => {
  'use strict';
  const { PRODUCTS, configured, db, formatMoney, formatDate, escapeHtml } = window.Store;
  const $ = id => document.getElementById(id);
  let api;
  let orders = [];
  let adminUserId = null;
  const STATUS = { pendiente: 'Pendiente', verificado: 'Pago verificado', entregado: 'Entregado', rechazado: 'Rechazado' };
  const display = (id, visible) => $(id).classList.toggle('hidden', !visible);
  const message = (id, msg) => $(id).textContent = msg;
  const busy = (btn, flag) => { if (btn) btn.disabled = flag; };
  function resetPanel() { adminUserId = null; orders = []; display('admin-dashboard', false); display('admin-login', true); }
  async function checkAdmin(user) {
    if (!user) return false;
    const { data, error } = await api.from('shop_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return Boolean(data?.user_id === user.id);
  }
  async function begin() {
    if (!configured) { display('admin-config', true); return; }
    try {
      api = db();
      const { data: sessionData, error: sessionError } = await api.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.user) { resetPanel(); return; }
      const { data, error } = await api.auth.getUser();
      if (error) throw error;
      if (!(await checkAdmin(data.user))) {
        await api.auth.signOut();
        resetPanel();
        message('login-msg', 'Esta cuenta no figura como administradora. Agregá su ID en shop_admins desde Supabase.');
        return;
      }
      adminUserId = data.user.id;
      display('admin-login', false);
      display('admin-dashboard', true);
      await loadOrders();
    } catch (error) {
      resetPanel();
      message('login-msg', 'Error al conectar: ' + (error.message || 'revisá la configuración de Supabase.'));
    }
  }
  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = $('login-btn'); busy(btn, true);
    message('login-msg', '');
    try {
      if (!api) api = db();
      const email = $('admin-email').value.trim();
      const password = $('admin-password').value;
      const { data, error } = await api.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!(await checkAdmin(data.user))) {
        await api.auth.signOut();
        throw new Error('Acceso denegado: tu usuario no está habilitado en shop_admins.');
      }
      $('admin-password').value = '';
      adminUserId = data.user.id;
      display('admin-login', false); display('admin-dashboard', true);
      await loadOrders();
    } catch (error) { message('login-msg', error.message || 'No se pudo iniciar sesión.'); }
    finally { busy(btn, false); }
  });
  $('logout-btn').addEventListener('click', async () => { await api.auth.signOut(); resetPanel(); });
  $('refresh-btn').addEventListener('click', loadOrders);
  $('search-orders').addEventListener('input', render);
  $('filter-status').addEventListener('change', render);
  async function loadOrders() {
    if (!adminUserId) return;
    message('panel-message', '');
    $('orders-list').innerHTML = '<div class="loader">Cargando pedidos…</div>';
    try {
      const { data, error } = await api.from('shop_orders').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      orders = data || [];
      render();
    } catch (error) {
      $('orders-list').innerHTML = '';
      message('panel-message', 'No se pudieron cargar los pedidos: ' + error.message);
    }
  }
  function commands(order, rows) {
    const nick = /^[A-Za-z0-9_]{3,16}$/.test(order.nickname) ? order.nickname : 'NICK';
    if (order.product_code === 'vip') return `lp user ${nick} parent addtemp vip 30d`;
    if (order.product_code === 'vipplus') return `lp user ${nick} parent addtemp vipplus 30d`;
    const product = PRODUCTS[order.product_code];
    if (!product) return 'Producto no reconocido. Verificá la compra.';
    return `lp user ${nick} permission settemp backpack.size.${rows} true ${product.days}d replace`;
  }
  function render() {
    const search = $('search-orders').value.trim().toLowerCase();
    const filter = $('filter-status').value;
    const visible = orders.filter(o => (filter === 'todos' || o.status === filter) &&
      [o.nickname, o.order_code, o.discord, o.transfer_reference, o.product_code].some(v => String(v || '').toLowerCase().includes(search)));
    $('stat-all').textContent = orders.length;
    $('stat-pending').textContent = orders.filter(o => o.status === 'pendiente').length;
    $('stat-verified').textContent = orders.filter(o => o.status === 'verificado').length;
    $('stat-delivered').textContent = orders.filter(o => o.status === 'entregado').length;
    if (!visible.length) { $('orders-list').innerHTML = '<div class="empty-state">No se encontraron pedidos para este filtro.</div>'; return; }
    const html = visible.map(order => {
      const p = PRODUCTS[order.product_code];
      const state = STATUS[order.status] || 'Desconocido';
      const isBag = p?.kind === 'backpack';
      const total = Number(order.total_ars || 0);
      const escapedId = escapeHtml(order.id);
      const span = (name, value) => `<div><small>${name}</small><strong>${escapeHtml(value)}</strong></div>`;
      return `<article class="order-item" data-id="${escapedId}">
        <div class="item-head"><div><h3>${escapeHtml(order.nickname)} · ${escapeHtml(p?.name || order.product_code)}</h3><small>${escapeHtml(order.order_code)} · ${escapeHtml(formatDate(order.created_at))}</small></div><span class="status-label ${escapeHtml(order.status)}">${escapeHtml(state)}</span></div>
        <div class="item-details">
          ${span('TOTAL DECLARADO POR CATÁLOGO', formatMoney(total))}
          ${span('CANTIDAD', `${order.quantity} ${isBag ? 'fila(s)' : 'rango'}`)}
          ${span('VIGENCIA', p?.duration || '—')}
          ${span('DISCORD', order.discord || 'No informado')}
          ${span('OPERACIÓN INFORMADA', order.transfer_reference || 'No informada')}
        </div>
        <label style="display:block;font-size:11px;color:#aea4c3" for="note-${escapedId}">Nota interna (solo administradores)</label>
        <input id="note-${escapedId}" class="admin-note-input" type="text" maxlength="500" value="${escapeHtml(order.admin_note || '')}" placeholder="Ej: confirmada transferencia / entregado desde consola">
        <div class="command-area"><small>Comando sugerido para la consola (NO se ejecuta desde esta web)</small>
          ${isBag ? `<label for="rows-${escapedId}" style="font-size:11px;color:#c5b2e6">Total de filas al entregar (revisá las filas activas del jugador):</label><select class="row-select" style="max-width:190px;height:36px;margin:7px 0 10px" id="rows-${escapedId}"><option value="3" ${2 + order.quantity === 3 ? 'selected' : ''}>3 filas</option><option value="4" ${2 + order.quantity === 4 ? 'selected' : ''}>4 filas</option><option value="5" ${2 + order.quantity === 5 ? 'selected' : ''}>5 filas</option><option value="6" ${2 + order.quantity === 6 ? 'selected' : ''}>6 filas</option></select>` : ''}
          <code class="command-value">${escapeHtml(commands(order, Math.min(6, 2 + Number(order.quantity))))}</code><button type="button" data-action="copy-command">Copiar comando</button>
          ${isBag ? '<small style="margin-top:8px">Una compra posterior o una expiración puede alterar el total de filas; comprobá siempre los permisos actuales.</small>' : ''}
        </div>
        <div class="item-actions"><button data-action="save-note">Guardar nota</button><button data-action="verificado" class="confirm" ${order.status === 'verificado' || order.status === 'entregado' ? 'disabled' : ''}>✓ Marcar pago verificado</button><button data-action="entregado" class="complete" ${order.status !== 'verificado' ? 'disabled' : ''}>✓ Marcar entregado</button><button data-action="rechazado" class="danger" ${order.status === 'entregado' ? 'disabled' : ''}>✕ Rechazar</button></div>
        </article>`;
    }).join('');
    $('orders-list').innerHTML = html;
  }
  $('orders-list').addEventListener('change', e => {
    if (e.target.classList.contains('row-select')) {
      const card = e.target.closest('.order-item');
      const order = orders.find(o => o.id === card?.dataset.id);
      if (order) card.querySelector('.command-value').textContent = commands(order, Number(e.target.value));
    }
  });
  $('orders-list').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    const card = btn.closest('.order-item'); const order = orders.find(o => o.id === card?.dataset.id);
    if (!order) return;
    const action = btn.dataset.action;
    if (action === 'copy-command') {
      const value = card.querySelector('.command-value').textContent;
      try { await navigator.clipboard.writeText(value); btn.textContent = '✓ Copiado'; setTimeout(() => btn.textContent = 'Copiar comando', 1400); }
      catch { window.prompt('Copiá este comando:', value); }
      return;
    }
    if (!['save-note', 'verificado', 'entregado', 'rechazado'].includes(action)) return;
    if (action === 'entregado' && order.status !== 'verificado') return;
    if (['verificado', 'rechazado'].includes(action) && !window.confirm(action === 'verificado' ? '¿Confirmaste el pago en Mercado Pago?' : '¿Rechazar este pedido?')) return;
    const note = card.querySelector('.admin-note-input').value.trim();
    const payload = action === 'save-note' ? {admin_note: note} : {status: action, admin_note: note};
    busy(btn, true);
    message('panel-message', '');
    try {
      // El servidor también exige pertenecer a shop_admins gracias a RLS.
      const {data, error} = await api.from('shop_orders').update(payload).eq('id', order.id).select('id,status,admin_note').single();
      if (error) throw error;
      order.status = data.status; order.admin_note = data.admin_note; render();
    } catch(error) { message('panel-message', 'No se pudo actualizar el pedido: ' + error.message); busy(btn, false); }
  });
  $('export-btn').addEventListener('click', () => {
    const cols = ['order_code','created_at','nickname','discord','transfer_reference','product_code','quantity','total_ars','status','admin_note'];
    const csv = [cols.join(';'), ...orders.map(o => cols.map(c => `"${String(o[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'pedidos-survival-' + new Date().toISOString().slice(0,10) + '.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  });
  begin();
})();
