(() => {
  'use strict';
  const { configured, db, money, date, esc, productColumns } = window.Store;
  const $ = id => document.getElementById(id);
  const STATUSES = { pendiente:'Pendiente', verificado:'Verificado', entregado:'Entregado', rechazado:'Rechazado' };
  let api, orders = [], products = [], activeTab = 'orders', editing = null;
  const info = (id, msg) => { $(id).textContent = msg || ''; };
  const show = (id, yes) => { $(id).hidden = !yes; };
  const busy = (id, yes) => { $(id).disabled = yes; };
  const error = msg => info('admin-error', msg);
  const isAdmin = async user => {
    if (!user) return false;
    const { data, error } = await api.from('shop_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if (error) throw error;
    return data?.user_id === user.id;
  };
  function reset() { orders = []; products = []; show('admin-dashboard',false); show('admin-login',true); show('logout-btn',false); }
  async function startup() {
    if (!configured) { show('admin-config',true); return; }
    try {
      api = db();
      const { data, error } = await api.auth.getUser();
      if (error && error.code !== 'session_not_found' && error.name !== 'AuthSessionMissingError') throw error;
      if (!data?.user) { reset(); return; }
      if (!(await isAdmin(data.user))) { await api.auth.signOut(); reset(); info('login-msg','Acceso no autorizado.'); return; }
      showDashboard(); await refreshAll();
    } catch (e) { reset(); info('login-msg',e.message || 'No se pudo conectar.'); }
  }
  function showDashboard() { show('admin-login',false); show('admin-config',false); show('admin-dashboard',true); show('logout-btn',true); }
  $('login-form').addEventListener('submit',async e => {
    e.preventDefault(); busy('login-btn',true); info('login-msg','');
    try { api ||= db(); const {data,error:e2} = await api.auth.signInWithPassword({email:$('admin-email').value.trim(),password:$('admin-password').value}); if(e2)throw e2;
      if (!(await isAdmin(data.user))) { await api.auth.signOut(); throw new Error('Esta cuenta no es administradora.'); }
      $('admin-password').value = ''; showDashboard(); await refreshAll();
    } catch(e2){info('login-msg',e2.message || 'No se pudo ingresar.');} finally { busy('login-btn',false); }
  });
  $('logout-btn').addEventListener('click',async () => { if (api) await api.auth.signOut(); reset(); });
  async function refreshAll() { await Promise.all([loadOrders(), loadProducts()]); }
  $('refresh-btn').addEventListener('click',refreshAll);
  async function loadOrders() {
    error('');
    try { const {data,error:e} = await api.from('shop_orders').select('*').order('created_at',{ascending:false}).limit(500);
      if(e)throw e; orders=data || []; $('orders-total').textContent=orders.length; renderOrders();
    } catch(e){error('Pedidos: '+e.message);}
  }
  async function loadProducts() {
    error('');
    try { const {data,error:e} = await api.from('shop_products').select(productColumns).order('display_order',{ascending:true}).order('name',{ascending:true});
      if(e)throw e; products=data||[]; $('products-total').textContent=products.length; renderProducts();
    } catch(e){error('Catálogo: '+e.message);}
  }
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
    activeTab=btn.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active',b===btn); b.setAttribute('aria-selected',String(b===btn)); });
    show('panel-orders',activeTab==='orders'); show('panel-products',activeTab==='products');
  }));
  $('status-filter').addEventListener('change',renderOrders);
  $('search-orders').addEventListener('input',renderOrders);
  const productByCode = code => products.find(p=>p.code===code);
  function orderCommand(o,rows) {
    const nick = o.nickname, days = Number(o.duration_days);
    if (o.delivery_type === 'manual') return 'Entrega manual: no hay comando definido para este producto';
    if (!/^[A-Za-z0-9_]{3,16}$/.test(nick) || days < 1 || days > 3650) return 'Revisá los datos del pedido';
    if (o.delivery_type === 'backpack') return `lp user ${nick} permission settemp backpack.size.${rows} true ${days}d replace`;
    if (o.delivery_type === 'rank' && /^[a-z][a-z0-9_-]{0,31}$/.test(o.rank_group || '')) return `lp user ${nick} parent addtemp ${o.rank_group} ${days}d`;
    return 'Entrega manual: no hay comando definido para este producto';
  }
  function renderOrders() {
    $('stat-pending').textContent=orders.filter(o=>o.status==='pendiente').length;
    $('stat-verified').textContent=orders.filter(o=>o.status==='verificado').length;
    $('stat-delivered').textContent=orders.filter(o=>o.status==='entregado').length;
    const term=$('search-orders').value.trim().toLowerCase(), status=$('status-filter').value;
    const filtered=orders.filter(o => (status==='todos'||o.status===status) && (!term||[o.order_code,o.nickname,o.discord,o.transfer_reference,o.product_name].some(v=>String(v||'').toLowerCase().includes(term))));
    $('orders-list').innerHTML=filtered.length ? filtered.map(o=> {
      const bag = o.delivery_type==='backpack';
      return `<article class="order-card" data-order="${esc(o.id)}"><div class="order-top"><div><span class="order-code">${esc(o.order_code)} · ${esc(date(o.created_at))}</span><h3>${esc(o.nickname)} <span>· ${esc(o.product_name || o.product_code)}</span></h3></div><span class="status-pill ${esc(o.status)}">${esc(STATUSES[o.status] || o.status)}</span></div>
        <div class="order-info"><div><span>IMPORTE</span><strong>${money(o.total_ars)}</strong></div><div><span>CANTIDAD</span><strong>${Number(o.quantity)}</strong></div><div><span>DISCORD</span><strong>${esc(o.discord || '—')}</strong></div><div><span>REFERENCIA</span><strong>${esc(o.transfer_reference || '—')}</strong></div><div><span>DURACIÓN</span><strong>${o.duration_days ? `${Number(o.duration_days)} días` : 'Entrega única'}</strong></div></div>
        <div class="command-box"><div class="command-head"><span>COMANDO SUGERIDO · COPIAR Y EJECUTAR EN CONSOLA</span>${bag ? `<label>Filas totales <select class="row-select"><option value="3" ${Number(o.quantity)+2===3?'selected':''}>3</option><option value="4" ${Number(o.quantity)+2===4?'selected':''}>4</option><option value="5" ${Number(o.quantity)+2===5?'selected':''}>5</option><option value="6" ${Number(o.quantity)+2===6?'selected':''}>6</option></select></label>`:''}</div><div class="command-line"><code>${esc(orderCommand(o,Math.min(6,Number(o.quantity)+2)))}</code><button type="button" data-action="copy" class="button button-secondary button-small">Copiar</button></div>${bag ? '<small>Comprobá las filas y vencimientos que ya tiene el jugador.</small>' : ''}</div>
        <div class="order-note"><label>Nota interna</label><input class="note-value" maxlength="500" value="${esc(o.admin_note || '')}" placeholder="Notas de entrega o verificación"></div>
        <div class="order-actions"><button type="button" class="button button-secondary button-small" data-action="save-note">Guardar nota</button><button type="button" class="button button-secondary button-small" data-action="verificado" ${o.status==='verificado'||o.status==='entregado'?'disabled':''}>Pago verificado</button><button type="button" class="button button-primary button-small" data-action="entregado" ${o.status!=='verificado'?'disabled':''}>Entregado</button><button type="button" class="button button-danger button-small" data-action="rechazado" ${o.status==='entregado'?'disabled':''}>Rechazar</button></div>
      </article>`;
    }).join('') : '<div class="empty-card">No hay pedidos para mostrar.</div>';
  }
  $('orders-list').addEventListener('change',e => {
    if (!e.target.matches('.row-select')) return;
    const card=e.target.closest('[data-order]'), o=orders.find(o=>o.id===card?.dataset.order);
    if(o)card.querySelector('.command-line code').textContent=orderCommand(o,Number(e.target.value));
  });
  $('orders-list').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action]'); if(!btn)return;
    const card=btn.closest('[data-order]'), o=orders.find(o=>o.id===card?.dataset.order); if(!o)return;
    const action=btn.dataset.action;
    if(action==='copy') { const value=card.querySelector('.command-line code').textContent; try { await navigator.clipboard.writeText(value); btn.textContent='Copiado ✓'; setTimeout(()=>btn.textContent='Copiar',1200); } catch {prompt('Copiar:',value);} return; }
    if (action==='entregado' && o.status!=='verificado') return;
    if (action==='verificado' && !confirm('¿Comprobaste el ingreso real del dinero en tu cuenta de Mercado Pago?'))return;
    if (action==='rechazado' && !confirm('¿Rechazar este pedido?'))return;
    const payload=action==='save-note'?{admin_note:card.querySelector('.note-value').value.trim()}:{status:action,admin_note:card.querySelector('.note-value').value.trim()};
    btn.disabled=true;error('');
    try { const {data,error:e2}=await api.from('shop_orders').update(payload).eq('id',o.id).select('status,admin_note').single();if(e2)throw e2;Object.assign(o,data);renderOrders(); }
    catch(e2){error('No se pudo actualizar el pedido: '+e2.message);btn.disabled=false;}
  });
  function renderProducts() {
    $('products-table').innerHTML=products.length ? products.map(p=>`<tr data-product="${esc(p.code)}"><td><div class="table-product"><span class="table-product-icon">${p.category==='rangos'?'✦':p.category==='mochilas'?'▦':'◇'}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.code)}</small></div></div></td><td>${esc({rangos:'Rangos',mochilas:'Mochilas',otros:'Otros'}[p.category]||p.category)}</td><td class="table-price">${money(p.price_ars)}</td><td><span class="stock ${p.active?'on':'off'}">${p.active?'Visible':'Oculto'}</span></td><td><div class="table-actions"><button class="button button-secondary button-small" type="button" data-product-action="edit">Editar</button><button class="button button-secondary button-small" type="button" data-product-action="toggle">${p.active?'Ocultar':'Publicar'}</button></div></td></tr>`).join('') : '<tr><td colspan="5">No hay productos.</td></tr>';
  }
  $('products-table').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-product-action]');if(!btn)return;
    const p=productByCode(btn.closest('[data-product]')?.dataset.product);if(!p)return;
    if(btn.dataset.productAction==='edit')return openEditor(p);
    if(!confirm(`¿${p.active?'Ocultar':'Publicar'} ${p.name}?`))return;
    btn.disabled=true;error('');
    try {const {error:e2}=await api.from('shop_products').update({active:!p.active}).eq('code',p.code);if(e2)throw e2;await loadProducts();}
    catch(e2){error('No se pudo cambiar la visibilidad: '+e2.message);btn.disabled=false;}
  });
  const fieldIds={code:'prod-code',name:'prod-name',description:'prod-description',category:'prod-category',price_ars:'prod-price',duration_days:'prod-days',max_quantity:'prod-max',badge:'prod-badge',display_order:'prod-order',delivery_type:'prod-delivery',rank_group:'prod-group'};
  function openEditor(p) {
    editing=p?.code||null; $('product-form').reset();
    $('editor-title').textContent=p?'Editar producto':'Nuevo producto'; $('prod-code').disabled=Boolean(p);
    for(const [key,id] of Object.entries(fieldIds))$(id).value=p?.[key]??({category:'otros',price_ars:500,max_quantity:1,display_order:100,delivery_type:'manual'}[key]??'');
    $('prod-features').value=(p?.features||[]).join('\n');$('prod-active').checked=p?.active??true;info('editor-error','');
    toggleRankField(); $('product-dialog').showModal();
  }
  const toggleRankField=()=>{const d=$('prod-delivery').value;show('rank-group-field',d==='rank');$('prod-group').required=d==='rank';$('prod-days').required=d!=='manual';};
  $('prod-delivery').addEventListener('change',toggleRankField);
  $('new-product-btn').addEventListener('click',()=>openEditor(null));
  function closeEditor(){ $('product-dialog').close(); }
  $('cancel-product').addEventListener('click',closeEditor);$('cancel-product-x').addEventListener('click',closeEditor);
  $('product-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!$('product-form').reportValidity())return;
    const features=$('prod-features').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const payload={};for(const [key,id] of Object.entries(fieldIds))payload[key]=$(id).value.trim();
    for(const key of ['price_ars','max_quantity','display_order'])payload[key]=Number(payload[key]);
    payload.duration_days=payload.duration_days?Number(payload.duration_days):null;
    payload.active=$('prod-active').checked;payload.features=features;payload.rank_group=payload.delivery_type==='rank'?payload.rank_group:null;
    if(features.length>6 || features.some(f=>f.length>110)){info('editor-error','Máximo 6 beneficios, de hasta 110 caracteres cada uno.');return;}
    if(!payload.name || !Number.isInteger(payload.price_ars) || payload.price_ars<1){info('editor-error','Revisá nombre y precio.');return;}
    if(editing) delete payload.code;
    busy('save-product',true);info('editor-error','');
    try {const req=editing?api.from('shop_products').update(payload).eq('code',editing):api.from('shop_products').insert(payload);
      const {error:e2}=await req;if(e2)throw e2;closeEditor();await loadProducts();
    }catch(e2){info('editor-error','No se pudo guardar: '+e2.message);}finally{busy('save-product',false);}
  });
  $('export-btn').addEventListener('click',()=>{
    const cols=['order_code','created_at','nickname','discord','transfer_reference','product_code','product_name','quantity','unit_price_ars','total_ars','duration_days','status','admin_note'];
    const data=[cols.join(';'),...orders.map(o=>cols.map(key=>'"'+String(o[key]??'').replace(/"/g,'""')+'"').join(';'))].join('\r\n');
    const blob=new Blob(['\ufeff'+data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pedidos-survival-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),800);
  });
  startup();
})();
