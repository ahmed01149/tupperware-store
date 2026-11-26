let products = [];
let cart = JSON.parse(localStorage.getItem('tup_cart') || '{}');
let activeCat = 'الكل';
let sb = null;

const fmt = n => n + ' ' + CONFIG.currency;
const $ = id => document.getElementById(id);

async function init() {
  document.title = CONFIG.storeName;
  $('storeName').textContent = CONFIG.storeName;
  $('announcement').textContent = CONFIG.announcement || '';
  $('deliveryNote').textContent = CONFIG.deliveryNote || '';
  $('vfNum').textContent = CONFIG.vfCash;
  $('vfOwner').textContent = 'محفظة ' + (CONFIG.vfCashName || '') + ' — فودافون كاش';
  if (CONFIG.supabaseUrl && CONFIG.supabaseKey) {
    sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    const { data: st } = await sb.from('settings').select('*').eq('id', 1).single();
    if (st) {
      if (st.store_name) CONFIG.storeName = st.store_name;
      if (st.whatsapp) CONFIG.whatsapp = st.whatsapp;
      if (st.vf_cash) CONFIG.vfCash = st.vf_cash;
      if (st.vf_cash_name) CONFIG.vfCashName = st.vf_cash_name;
      if (st.delivery_note) CONFIG.deliveryNote = st.delivery_note;
      if (st.announcement) CONFIG.announcement = st.announcement;
      document.title = CONFIG.storeName;
      $('storeName').textContent = CONFIG.storeName;
      $('announcement').textContent = CONFIG.announcement || '';
      $('deliveryNote').textContent = CONFIG.deliveryNote || '';
      $('vfNum').textContent = CONFIG.vfCash;
      $('vfOwner').textContent = 'محفظة ' + (CONFIG.vfCashName || '') + ' — فودافون كاش';
    }
    const { data } = await sb.from('products').select('*').eq('available', true).order('sort');
    products = data || [];
  } else {
    const res = await fetch('products.json');
    products = await res.json();
  }
  renderCats(); renderGrid(); renderCartBar();
}

function renderCats() {
  const cats = ['الكل', ...new Set(products.map(p => p.category))];
  $('cats').innerHTML = cats.map(c =>
    `<button class="${c === activeCat ? 'active' : ''}" onclick="setCat('${c}')">${c}</button>`).join('');
}
function setCat(c) { activeCat = c; renderCats(); renderGrid(); }

function renderGrid() {
  const list = activeCat === 'الكل' ? products : products.filter(p => p.category === activeCat);
  $('grid').innerHTML = list.map(p => {
    const q = cart[p.id] || 0;
    const action = q === 0
      ? `<button class="add" onclick="chg('${p.id}',1)">أضف للسلة 🛒</button>`
      : `<div class="qty"><button onclick="chg('${p.id}',1)">+</button><span>${q}</span><button onclick="chg('${p.id}',-1)">−</button></div>`;
    return `<div class="card">
      <div class="img" style="background:${p.color || '#f5f5f5'}">${p.photo_url ? `<img src="${p.photo_url}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : (p.emoji || '🥡')}</div>
      <div class="body">
        <div class="name">${p.name}</div>
        <div class="desc">${p.desc || ''}</div>
        <div class="price">${fmt(p.price)}</div>
        ${action}
      </div></div>`;
  }).join('') || '<p style="text-align:center;color:#999;padding:30px">لسه مفيش منتجات هنا</p>';
}

function chg(id, d) {
  cart[id] = (cart[id] || 0) + d;
  if (cart[id] <= 0) delete cart[id];
  localStorage.setItem('tup_cart', JSON.stringify(cart));
  renderGrid(); renderCartBar();
  if (!$('cartModal').classList.contains('hidden')) renderCartItems();
}

function cartList() { return Object.entries(cart).map(([id, q]) => ({...products.find(p => p.id == id), q})).filter(p => p.name); }
function cartTotal() { return cartList().reduce((s, p) => s + p.price * p.q, 0); }
function cartCount() { return Object.values(cart).reduce((s, q) => s + q, 0); }

function renderCartBar() {
  const n = cartCount();
  $('cartBar').classList.toggle('hidden', n === 0);
  $('cartBarText').textContent = n + ' منتج — ' + fmt(cartTotal());
}

function openCart() { renderCartItems(); $('cartModal').classList.remove('hidden'); }
function renderCartItems() {
  const list = cartList();
  $('cartItems').innerHTML = list.length ? list.map(p => `
    <div class="cart-line">
      <span class="nm">${p.photo_url ? '🥡' : p.emoji} ${p.name}</span>
      <span class="mini">
        <button onclick="chg('${p.id}',-1)">−</button><b>${p.q}</b><button onclick="chg('${p.id}',1)">+</button>
      </span>
      <b>${fmt(p.price * p.q)}</b>
    </div>`).join('') : '<p style="text-align:center;color:#999;padding:20px">السلة فاضية</p>';
  $('cartTotal').textContent = fmt(cartTotal());
}

function goCheckout() {
  if (!cartCount()) return;
  $('cartModal').classList.add('hidden');
  $('checkoutTotal').textContent = fmt(cartTotal());
  $('checkoutModal').classList.remove('hidden');
}

function goPayment() {
  const name = $('fName').value.trim(), phone = $('fPhone').value.trim(), addr = $('fAddr').value.trim();
  if (!name || !/^01\d{9}$/.test(phone) || !addr) { alert('اكتبي الاسم ورقم موبايل صح (11 رقم يبدأ بـ 01) والعنوان بالتفصيل 🙏'); return; }
  $('checkoutModal').classList.add('hidden');
  $('vfAmount').textContent = 'المبلغ المطلوب: ' + fmt(cartTotal());
  $('payModal').classList.remove('hidden');
}

function copyVf() {
  navigator.clipboard.writeText(CONFIG.vfCash).then(() => alert('رقم المحفظة اتنسخ ✅'));
}

async function submitOrder() {
  const payFrom = $('fPayFrom').value.trim();
  if (!/^01\d{9}$/.test(payFrom)) { alert('اكتبي رقم الموبايل اللي حوّلتي منه (11 رقم) عشان صاحبة المحل تطابق التحويل 🙏'); return; }
  const btn = document.querySelector('#payModal .primary');
  btn.disabled = true; btn.textContent = 'جاري تسجيل الطلب...';
  const orderNo = 'T' + Date.now().toString().slice(-6);
  const items = cartList().map(p => ({ name: p.name, q: p.q, price: p.price }));
  const total = cartTotal();
  const order = {
    order_no: orderNo,
    customer_name: $('fName').value.trim(),
    phone: $('fPhone').value.trim(),
    address: $('fAddr').value.trim(),
    notes: $('fNotes').value.trim(),
    items, total,
    pay_from: payFrom,
    pay_ref: $('fPayRef').value.trim(),
    status: 'pending_payment'
  };
  if (sb) await sb.from('orders').insert(order);
  const lines = items.map(p => `• ${p.name} ×${p.q} = ${p.price * p.q} ${CONFIG.currency}`);
  const msg =
`🛒 طلب جديد رقم ${orderNo}
(بانتظار تأكيد الدفع ⏳)

👤 الاسم: ${order.customer_name}
📱 الموبايل: ${order.phone}
📍 العنوان: ${order.address}
${order.notes ? '📝 ملاحظات: ' + order.notes + '\n' : ''}
🧺 المنتجات:
${lines.join('\n')}

💰 الإجمالي: ${total} ${CONFIG.currency}
💸 الدفع: فودافون كاش من رقم ${payFrom}${order.pay_ref ? ' — مرجع: ' + order.pay_ref : ''}
📎 سكرين شوت التحويل هيتبعت هنا في الشات.`;
  window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg), '_blank');
  $('payModal').classList.add('hidden');
  $('doneText').textContent = 'طلبك رقم ' + orderNo + ' اتسجل واتبعت على واتساب. ابعتي سكرين شوت التحويل في الشات وصاحبة المحل هتأكدلك الطلب 💛';
  $('doneModal').classList.remove('hidden');
  cart = {}; localStorage.setItem('tup_cart', '{}');
  btn.disabled = false; btn.textContent = 'تأكيد الطلب وإرساله ✅';
  renderGrid(); renderCartBar();
}

function closeAll() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

init();
