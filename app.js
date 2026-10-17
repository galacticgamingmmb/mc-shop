(() => {
  'use strict';
  const { cfg, configured, db, money, esc, orderCode, demoProducts, productColumns } = window.Store;
  const $ = id => document.getElementById(id);
  let products = [], selected = null, filter = 'todos';
  let paymentSettings = { account_holder:'', payment_alias:cfg.paymentAlias || 'dev.cristianm.mp', cbu_cvu:'', bank_name:'', wallet_name:'' };
  const expandedFeatures = new Set();
  const name = (cfg.brand || 'SURVIVAL').trim() || 'SURVIVAL';
  $('brand-title').textContent = name.toUpperCase();
  document.title = `${name} — Tienda`;
  $('side-alias').textContent = paymentSettings.payment_alias;
  renderPaymentSettings();
  if (/^https:\/\//.test(cfg.supportUrl || '')) { $('support-link').href = cfg.supportUrl; $('support-link').hidden = false; }
  if (cfg.serverIp) { document.querySelector('.intro-meta').insertAdjacentHTML('afterbegin', `<span>${esc(cfg.serverIp)}</span>`); }

  const categories = { todos:'Todos los productos', rangos:'Rangos', mochilas:'Mochilas', otros:'Otros' };
  const categoryLabel = { rangos:'RANGO', mochilas:'MOCHILA', otros:'PRODUCTO' };
  const icon = category => category === 'rangos' ? '✦' : category === 'mochilas' ? '▦' : '◇';
  const alert = msg => { $('store-alert').hidden = !msg; $('store-alert').textContent = msg; };
  function render() {
    for (const cat of Object.keys(categories)) {
      const count = cat === 'todos' ? products.length : products.filter(p => p.category === cat).length;
      $('count-'+cat).textContent = count;
    }
    const visible = products.filter(p => filter === 'todos' || p.category === filter);
    $('catalog-title').textContent = categories[filter];
    $('catalog-count').textContent = `${visible.length} ${visible.length === 1 ? 'producto' : 'productos'}`;
    $('product-grid').innerHTML = visible.length ? visible.map(p => `
      <article class="store-product ${p.badge ? 'emphasis' : ''}">
        <div class="product-art ${esc(p.category)}"><span class="art-mark">${icon(p.category)}</span><span class="art-category">${esc(categoryLabel[p.category] || 'PRODUCTO')}</span></div>
        <div class="product-body"><div class="product-label-line"><span class="product-kind">${esc(categoryLabel[p.category] || 'PRODUCTO')}</span>${p.badge ? `<span class="highlight-label">${esc(p.badge)}</span>` : ''}</div>
        <h3>${esc(p.name)}</h3><p class="product-description">${esc(p.description || '')}</p>
        <ul class="feature-list">${((expandedFeatures.has(p.code) ? (p.features || []) : (p.features || []).slice(0,6))).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        ${(p.features || []).length > 6 ? `<button class="features-toggle" type="button" data-features-toggle="${esc(p.code)}" aria-expanded="${expandedFeatures.has(p.code)}">${expandedFeatures.has(p.code) ? 'Mostrar menos' : `Ver ${p.features.length - 6} beneficios más`}</button>` : ''}
        <div class="card-bottom"><div class="card-price"><strong>${money(p.price_ars)}</strong><small>${p.duration_days ? `${Number(p.duration_days)} ${Number(p.duration_days) === 1 ? 'día' : 'días'}` : 'Entrega única'} ${p.max_quantity > 1 ? '· por unidad' : ''}</small></div><button class="button buy-button" type="button" data-buy="${esc(p.code)}" ${!configured ? 'disabled title="Configurá Supabase para habilitar pedidos"' : ''}>Comprar <span>↗</span></button></div></div>
      </article>`).join('') : `<div class="empty-card">Todavía no hay productos en esta categoría.</div>`;
  }
  $('categories').addEventListener('click', e => { const button = e.target.closest('button[data-category]'); if (!button) return; filter = button.dataset.category; document.querySelectorAll('.category').forEach(b => b.classList.toggle('active', b === button)); render(); });
  $('product-grid').addEventListener('click', e => {
    const more = e.target.closest('[data-features-toggle]');
    if (more) { const code = more.dataset.featuresToggle; expandedFeatures.has(code) ? expandedFeatures.delete(code) : expandedFeatures.add(code); render(); return; }
    const button = e.target.closest('[data-buy]'); if (button) openCheckout(button.dataset.buy);
  });
  $('close-checkout').addEventListener('click', () => { $('checkout').hidden = true; selected = null; });
  $('quantity').addEventListener('change', updateAmount);
  function openCheckout(code) {
    selected = products.find(p => p.code === code);
    if (!selected || !configured) return;
    $('checkout').hidden = false;
    $('checkout-name').textContent = selected.name;
    $('checkout-description').textContent = selected.description || '';
    $('checkout-duration').textContent = selected.duration_days ? `${selected.duration_days} días` : 'Entrega única';
    $('quantity').replaceChildren();
    for (let n = 1; n <= Math.min(Number(selected.max_quantity) || 1, 10); n++) {
      const option = document.createElement('option'); option.value = n; option.textContent = `${n} ${n === 1 ? 'unidad' : 'unidades'}`; $('quantity').appendChild(option);
    }
    $('quantity-label').hidden = Number(selected.max_quantity) === 1;
    $('quantity').hidden = Number(selected.max_quantity) === 1;
    $('form-message').textContent = '';
    $('form-message').className = 'form-feedback';
    updateAmount();
    $('checkout').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start' });
  }
  function updateAmount() { $('checkout-price').textContent = selected ? money(selected.price_ars * Number($('quantity').value || 1)) : money(0); }
  function renderPaymentSettings() {
    const alias = String(paymentSettings.payment_alias || '').trim();
    $('side-alias').textContent = alias || 'No configurado';
    const details = [
      ['account_holder','Titular',paymentSettings.account_holder],
      ['payment_alias','Alias',alias],
      ['cbu_cvu','CBU / CVU',paymentSettings.cbu_cvu],
      ['bank_name','Banco',paymentSettings.bank_name],
      ['wallet_name','Billetera virtual',paymentSettings.wallet_name]
    ].filter(item => String(item[2] || '').trim());
    $('payment-details').innerHTML = details.length ? details.map(([key,label,value]) => `<div class="payment-detail-row"><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div><button type="button" class="payment-copy" data-copy-payment="${esc(key)}" aria-label="Copiar ${esc(label)}">Copiar</button></div>`).join('') : '<p class="payment-empty">Todavía no se configuraron los datos de transferencia.</p>';
  }
  function setPaymentCardFlipped(flipped) {
    $('payment-card').classList.toggle('is-flipped', flipped);
    $('payment-card-front').setAttribute('aria-hidden', String(flipped));
    $('payment-card-back').setAttribute('aria-hidden', String(!flipped));
    $('payment-card-front').inert = flipped;
    $('payment-card-back').inert = !flipped;
  }
  $('reveal-payment').addEventListener('click', () => setPaymentCardFlipped(true));
  $('payment-card-front').addEventListener('click', e => { if (!e.target.closest('button')) setPaymentCardFlipped(true); });
  $('hide-payment').addEventListener('click', () => setPaymentCardFlipped(false));
  $('payment-card').addEventListener('keydown', e => {
    if (e.key === 'Escape') setPaymentCardFlipped(false);
  });
  $('payment-details').addEventListener('click', async e => {
    const button = e.target.closest('[data-copy-payment]'); if (!button) return;
    const key = button.dataset.copyPayment;
    const value = key === 'payment_alias' ? paymentSettings.payment_alias : paymentSettings[key];
    if (!value) return;
    try { await navigator.clipboard.writeText(value); button.textContent = 'Copiado ✓'; setTimeout(() => { if (button.isConnected) button.textContent = 'Copiar'; }, 1400); }
    catch { window.prompt('Copiar dato:', value); }
  });
  async function loadPaymentSettings() {
    if (!configured) { renderPaymentSettings(); return; }
    try {
      const { data, error } = await db().from('shop_payment_settings').select('account_holder,payment_alias,cbu_cvu,bank_name,wallet_name').eq('id',1).maybeSingle();
      if (error) throw error;
      if (data) paymentSettings = { ...data };
      renderPaymentSettings();
    } catch (error) {
      console.error('No se pudieron cargar los datos de transferencia:', error);
      renderPaymentSettings();
      alert('El catálogo puede funcionar, pero faltan los datos de pago en Supabase. Ejecutá MIGRAR-V2-A-V3.sql y recargá.');
    }
  }
  $('order-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!selected || !configured || !$('order-form').reportValidity() || $('website').value) return;
    const nickname = $('nickname').value.trim(), quantity = Number($('quantity').value);
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(nickname) || !Number.isInteger(quantity) || quantity < 1 || quantity > selected.max_quantity) return;
    const button = $('send-order'); button.disabled = true; button.textContent = 'Enviando…';
    $('form-message').textContent = '';
    const code = orderCode();
    try {
      const { error } = await db().from('shop_orders').insert({ order_code:code, product_code:selected.code, quantity, nickname, discord:$('discord').value.trim() || null, transfer_reference:$('transfer-ref').value.trim() || null });
      if (error) throw error;
      $('form-message').className = 'form-feedback success';
      $('form-message').innerHTML = `Pedido registrado: <strong>${esc(code)}</strong>. Guardá el código. La transferencia se verifica manualmente.`;
      $('confirm-transfer').checked = false; $('transfer-ref').value = '';
    } catch (error) { console.error(error); $('form-message').className = 'form-feedback error'; $('form-message').textContent = 'No se pudo enviar el pedido. Intentá de nuevo o consultá con administración.'; }
    finally { button.textContent = 'Enviar pedido ↗'; button.disabled = false; }
  });
  async function init() {
    if (!configured) { products = demoProducts; alert('Vista previa. Conectá Supabase para habilitar las compras y editar productos desde el panel.'); render(); renderPaymentSettings(); return; }
    await loadPaymentSettings();
    try {
      const { data, error } = await db().from('shop_products').select(productColumns).eq('active',true).order('display_order',{ascending:true}).order('name',{ascending:true});
      if (error) throw error;
      products = data || []; $('send-order').disabled = false; render();
    } catch (error) { console.error(error); alert('No se pudo cargar el catálogo. Revisá la configuración de Supabase y el SQL de la tienda.'); $('product-grid').innerHTML = '<div class="empty-card">Catálogo no disponible.</div>'; }
  }
  init();
})();
