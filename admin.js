const $ = id => document.getElementById(id);
let sb = null;
const fmt = n => { const v = Number(n); return (Number.isInteger(v) ? String(v) : v.toFixed(2)) + ' ' + CONFIG.currency; };
const STATUS = {
  pending_payment: ['بانتظار الدفع ⏳', 'b-pending'],
  confirmed: ['مدفوع ✅', 'b-confirmed'],
  rejected: ['مرفوض ❌', 'b-rejected'],
  done: ['اتسلّم 📦', 'b-done']
};

initAdmin();

function initAdmin() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    $('loginErr').textContent = 'الباك إند مش متظبط لسه';
    return;
  }
  sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  sb.auth.getSession().then(({ data }) => { if (data.session) showPanel(); });
}

async function login() {
  const { error } = await sb.auth.signInWithPassword({ email: $('aEmail').value.trim(), password: $('aPass').value });
  if (error) { $('loginErr').textContent = 'بيانات الدخول غلط، حاولي تاني'; return; }
  showPanel();
}

async function logout() { await sb.auth.signOut(); location.reload(); }

function showPanel() {
  $('loginBox').classList.add('hidden');
  $('panel').classList.remove('hidden');
  loadOrders(); loadProducts();
}

function showTab(t) {
  $('tabOrders').classList.toggle('active', t === 'orders');
  $('tabProducts').classList.toggle('active', t === 'products');
  $('tabSettings').classList.toggle('active', t === 'settings');
  $('ordersTab').classList.toggle('hidden', t !== 'orders');
  $('productsTab').classList.toggle('hidden', t !== 'products');
  $('settingsTab').classList.toggle('hidden', t !== 'settings');
  if (t === 'settings') loadSettings();
}

async function loadSettings() {
  const { data: st } = await sb.from('settings').select('*').eq('id', 1).single();
  if (!st) return;
  $('sName').value = st.store_name || '';
  $('sWhats').value = st.whatsapp || '';
  $('sVf').value = st.vf_cash || '';
  $('sVfName').value = st.vf_cash_name || '';
  $('sDeliv').value = st.delivery_note || '';
  $('sAnn').value = st.announcement || '';
}

async function saveSettings() {
  const row = {
    id: 1,
    store_name: $('sName').value.trim(),
    whatsapp: $('sWhats').value.trim(),
    vf_cash: $('sVf').value.trim(),
    vf_cash_name: $('sVfName').value.trim(),
    delivery_note: $('sDeliv').value.trim(),
    announcement: $('sAnn').value.trim()
  };
  const { error } = await sb.from('settings').upsert(row);
  $('setMsg').textContent = error ? 'حصل خطأ في الحفظ، حاولي تاني' : 'اتحفظ ✅ التعديلات هتظهر على الموقع فورا';
}

async function loadOrders() {
  const { data } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  const orders = data || [];
  const pend = orders.filter(o => o.status === 'pending_payment').length;
  const conf = orders.filter(o => o.status === 'confirmed').length;
  $('stats').innerHTML = `<div class="stat"><b>${pend}</b>بانتظار الدفع</div><div class="stat"><b>${conf}</b>مدفوع</div><div class="stat"><b>${orders.length}</b>كل الطلبات</div>`;
  $('ordersTab').innerHTML = orders.length ? orders.map(o => {
    const [label, cls] = STATUS[o.status] || [o.status, 'b-pending'];
    const items = (o.items || []).map(i => `• ${i.name} ×${i.q}`).join('<br>');
    let btns = '';
    if (o.status === 'pending_payment') btns = `<button class="ok" onclick="setStatus('${o.id}','confirmed')">تأكيد الدفع ✅</button><button class="no" onclick="setStatus('${o.id}','rejected')">رفض ❌</button>`;
    else if (o.status === 'confirmed') btns = `<button class="done" onclick="setStatus('${o.id}','done')">اتسلّم 📦</button>`;
    return `<div class="order">
      <div class="head"><b>طلب ${o.order_no}</b><span class="badge ${cls}">${label}</span></div>
      <div class="row">👤 ${o.customer_name} — 📱 <span dir="ltr">${o.phone}</span></div>
      <div class="row">📍 ${o.address}</div>
      ${o.notes ? `<div class="row">📝 ${o.notes}</div>` : ''}
      <div class="row">🧺 ${items}</div>
      <div class="row">💰 <b>${fmt(o.total)}</b> — 💸 من رقم <span dir="ltr">${o.pay_from || '؟'}</span>${o.pay_ref ? ' — مرجع: ' + o.pay_ref : ''}</div>
      <div class="row" style="color:#aaa;font-size:12px">${new Date(o.created_at).toLocaleString('ar-EG')}</div>
      <div class="actions">${btns}</div>
    </div>`;
  }).join('') : '<p style="text-align:center;color:#999;padding:24px">مفيش طلبات لسه</p>';
}

async function setStatus(id, status) {
  await sb.from('orders').update({ status }).eq('id', id);
  loadOrders();
}

async function loadProducts() {
  const { data } = await sb.from('products').select('*').order('sort');
  const prods = data || [];
  $('prodList').innerHTML = prods.map(p => `
    <div class="prod-row ${p.available ? '' : 'avail-off'}">
      ${p.photo_url ? `<img src="${p.photo_url}">` : `<div class="ph">${p.emoji || '🥡'}</div>`}
      <div class="info"><b>${p.name}</b><span>${fmt(p.price)} — ${p.category || ''}</span></div>
      <button class="icon-btn" onclick="toggleAvail('${p.id}',${!p.available})">${p.available ? 'إخفاء' : 'إظهار'}</button>
      <button class="icon-btn" onclick="editPrice('${p.id}',${p.price})">تعديل سعر</button>
      <button class="icon-btn" onclick="delProduct('${p.id}')">🗑</button>
    </div>`).join('');
}

async function addProduct() {
  const name = $('pName').value.trim(), price = parseFloat($('pPrice').value);
  if (!name || !Number.isFinite(price) || price <= 0) { alert('اكتبي الاسم والسعر'); return; }
  let photo_url = null;
  const file = $('pPhoto').files[0];
  if (file) {
    const ext = file.name.split('.').pop();
    const path = 'p_' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from('product-photos').upload(path, file);
    if (!error) photo_url = CONFIG.supabaseUrl + '/storage/v1/object/public/product-photos/' + path;
  }
  await sb.from('products').insert({ name, price, category: $('pCat').value.trim() || 'علب', desc: $('pDesc').value.trim(), photo_url, available: true });
  $('pName').value = $('pPrice').value = $('pCat').value = $('pDesc').value = ''; $('pPhoto').value = '';
  loadProducts();
}

async function toggleAvail(id, v) { await sb.from('products').update({ available: v }).eq('id', id); loadProducts(); }
async function editPrice(id, cur) {
  const v = prompt('السعر الجديد:', cur);
  const price = parseFloat(v);
  if (v && Number.isFinite(price) && price > 0) { await sb.from('products').update({ price }).eq('id', id); loadProducts(); }
}
async function delProduct(id) {
  if (confirm('متأكدة إنك عايزة تمسحي المنتج ده؟')) { await sb.from('products').delete().eq('id', id); loadProducts(); }
}
