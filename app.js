(() => {
  'use strict';
  const { PRODUCTS, cfg, configured, db, formatMoney, randomCode, transferAlias } = window.Store;
  const $ = id => document.getElementById(id);
  const productSelect = $('product-select');
  const quantitySelect = $('quantity');
  const form = $('order-form');
  const btnSubmit = $('send-order');
  const formMessage = $('form-message');
  const items = ['⛏','▣','🪓','✦','▥','◆','⬡','▰','☘','⚒','✚','◈','▧','☀','▦','⬟','◇','☷'];
  const grid = $('inventory-grid');
  const elements = [];
  for (let slot = 0; slot < 54; slot++) {
    const cell = document.createElement('div');
    cell.className = 'inv-slot' + (slot >= 18 ? ' locked' : '');
    cell.textContent = slot < 18 ? items[slot] : '⊞';
    grid.appendChild(cell);
    elements.push(cell);
  }
  const update = () => {
    const product = PRODUCTS[productSelect.value];
    const isBag = product.kind === 'backpack';
    $('quantity-wrap').hidden = !isBag;
    quantitySelect.disabled = !isBag;
    let qty = isBag ? Number(quantitySelect.value) : 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 4) qty = 1;
    $('order-total').textContent = formatMoney(product.price * qty);
    $('order-duration').textContent = product.duration;
    const rowCount = isBag ? Math.min(6, 2 + qty) : 2;
    $('preview-level').textContent = rowCount + '/6 FILAS';
    $('inv-progress').style.width = (rowCount / 6 * 100) + '%';
    elements.forEach((cell, index) => {
      const active = index < rowCount * 9;
      cell.classList.toggle('locked', !active);
      cell.classList.toggle('unlocked', active && index >= 18);
      cell.textContent = index < 18 ? items[index] : (active ? '✧' : '⊞');
    });
    if (!configured) {
      btnSubmit.disabled = true;
      formMessage.className = 'form-message error';
      formMessage.textContent = 'El administrador todavía no conectó el formulario de pedidos. La tienda está en modo vista previa.';
    }
  };
  $('payment-alias').textContent = transferAlias;
  if (cfg.brand?.trim()) {
    document.querySelectorAll('.brand strong').forEach(el => el.textContent = cfg.brand.trim().toUpperCase());
    document.title = cfg.brand.trim() + ' Store — Mochilas y rangos';
  }
  const support = cfg.supportUrl?.trim();
  if (support && /^https:\/\//.test(support)) { $('support-link').href = support; $('support-container').hidden = false; }
  $('copy-alias').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(transferAlias); $('copy-alias').textContent = '✓'; setTimeout(() => $('copy-alias').textContent = '⧉', 1800); }
    catch { window.prompt('Copiá el alias:', transferAlias); }
  });
  document.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => {
    productSelect.value = button.dataset.product;
    quantitySelect.value = '1';
    update();
    $('comprar').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }));
  productSelect.addEventListener('change', update);
  quantitySelect.addEventListener('change', update);
  update();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured || !form.reportValidity()) return;
    if ($('website').value) return;
    const code = productSelect.value;
    const product = PRODUCTS[code];
    const qty = product.kind === 'backpack' ? Number(quantitySelect.value) : 1;
    const nick = $('nickname').value.trim();
    const discord = $('discord').value.trim();
    const transferRef = $('transfer-ref').value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(nick) || !Number.isInteger(qty) || qty < 1 || qty > product.maxQuantity) return;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando pedido…';
    formMessage.className = 'form-message';
    formMessage.textContent = '';
    const orderCode = randomCode();
    try {
      // El total y el estado se fijan en la base de datos, no los controla el navegador.
      const { error } = await db().from('shop_orders').insert({
        order_code: orderCode,
        nickname: nick,
        discord: discord || null,
        transfer_reference: transferRef || null,
        product_code: code,
        quantity: qty,
      });
      if (error) throw error;
      formMessage.className = 'form-message success';
      formMessage.innerHTML = `¡Pedido enviado! Guardá tu código <strong>${orderCode}</strong>. El pago será verificado manualmente; esto no confirma la recepción de tu transferencia.`;
      $('confirm-transfer').checked = false;
      $('transfer-ref').value = '';
    } catch (err) {
      console.error('No se pudo crear el pedido:', err);
      formMessage.className = 'form-message error';
      formMessage.textContent = 'No pudimos guardar el pedido. Revisá tu conexión y volvé a intentar. Si el error continúa, contactá a un administrador.';
    } finally { btnSubmit.disabled = false; btnSubmit.innerHTML = 'Enviar pedido para revisión <span>→</span>'; }
  });
})();
