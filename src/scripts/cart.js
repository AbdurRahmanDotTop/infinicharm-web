const CART_STORAGE_KEY = 'infinicharm-demo-cart-v1';

function readCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.slug === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    showToast('Your browser could not save the demo bag.');
  }
  updateCartCounts();
  renderCartPage();
}

function showToast(message) {
  const toast = document.querySelector('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function updateCartCounts() {
  const totalQuantity = readCart().reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach((element) => {
    element.textContent = String(totalQuantity);
    element.setAttribute('aria-label', `${totalQuantity} items in bag`);
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function renderCartPage() {
  const root = document.querySelector('[data-cart-root]');
  const container = document.querySelector('[data-cart-items]');
  if (!root || !container) return;

  let products = [];
  try { products = JSON.parse(root.dataset.products || '[]'); } catch { products = []; }
  const productMap = new Map(products.map((product) => [product.slug, product]));
  const cart = readCart().filter((item) => productMap.has(item.slug));
  container.replaceChildren();
  let subtotal = 0;
  let quantityCount = 0;

  cart.forEach((item) => {
    const product = productMap.get(item.slug);
    if (!product) return;
    const lineTotal = product.price * item.quantity;
    subtotal += lineTotal;
    quantityCount += item.quantity;

    const row = createElement('article', 'cart-item');
    const imageLink = createElement('a', 'cart-item-image');
    imageLink.href = `/product/${product.slug}/`;
    const image = document.createElement('img');
    image.src = product.image;
    image.alt = `Demo placeholder for ${product.name}`;
    image.width = 140; image.height = 140; image.loading = 'lazy';
    imageLink.append(image);

    const info = createElement('div', 'cart-item-info');
    const link = createElement('a', 'cart-item-name', product.name);
    link.href = `/product/${product.slug}/`;
    const unitPrice = createElement('span', 'cart-item-unit-price', formatMoney(product.price));
    const quantity = document.createElement('label');
    quantity.className = 'quantity-label';
    const quantityText = createElement('span', 'sr-only', `Quantity for ${product.name}`);
    const input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.max = '20'; input.step = '1'; input.value = String(item.quantity);
    input.setAttribute('aria-label', `Quantity for ${product.name}`);
    input.setAttribute('data-cart-quantity', item.slug);
    quantity.append(quantityText, input);
    info.append(link, unitPrice, quantity);

    const end = createElement('div', 'cart-item-end');
    end.append(createElement('strong', 'cart-item-line-total', formatMoney(lineTotal)));
    const remove = createElement('button', 'text-button cart-remove', 'Remove');
    remove.type = 'button'; remove.setAttribute('data-remove-cart', item.slug);
    end.append(remove);
    row.append(imageLink, info, end);
    container.append(row);
  });

  const empty = document.querySelector('[data-cart-empty]');
  const listHeading = document.querySelector('[data-cart-items-count]');
  if (empty) empty.hidden = cart.length > 0;
  if (listHeading) listHeading.textContent = `(${quantityCount} ${quantityCount === 1 ? 'item' : 'items'})`;
  const subtotalElement = document.querySelector('[data-cart-subtotal]');
  const totalElement = document.querySelector('[data-cart-total]');
  if (subtotalElement) subtotalElement.textContent = formatMoney(subtotal);
  if (totalElement) totalElement.textContent = formatMoney(subtotal);
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const addButton = target.closest('[data-add-to-cart]');
  if (addButton) {
    const slug = addButton.getAttribute('data-product-slug');
    if (!slug) return;
    const cart = readCart();
    const existing = cart.find((item) => item.slug === slug);
    if (existing) {
      if (existing.quantity >= 20) { showToast('Demo limit: maximum 20 of one item.'); return; }
      existing.quantity += 1;
    } else {
      cart.push({ slug, quantity: 1 });
    }
    saveCart(cart);
    showToast('Added to your demo bag.');
    return;
  }

  const removeButton = target.closest('[data-remove-cart]');
  if (removeButton) {
    const slug = removeButton.getAttribute('data-remove-cart');
    saveCart(readCart().filter((item) => item.slug !== slug));
    showToast('Item removed from your demo bag.');
    return;
  }

  if (target.closest('[data-clear-cart]')) {
    saveCart([]);
    showToast('Demo bag cleared.');
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches('[data-cart-quantity]')) return;
  const slug = target.getAttribute('data-cart-quantity');
  const quantity = Math.max(1, Math.min(20, Number.parseInt(target.value, 10) || 1));
  const cart = readCart();
  const item = cart.find((entry) => entry.slug === slug);
  if (item) item.quantity = quantity;
  saveCart(cart);
});

window.addEventListener('storage', updateCartCounts);
updateCartCounts();
renderCartPage();
