/**
 * StockWise — Local data store (localStorage)
 * Replaces Firebase for frontend-only development.
 * Swap this out for Firebase when ready.
 */

const KEYS = {
  user:     'sw_user',
  products: 'sw_products',
  sales:    'sw_sales',
};

// ── Seed data ───────────────────────────────────────────────

const SEED_PRODUCTS = [
  { id: 'p1', name: 'Wireless Headphones',  category: 'Electronics',  price: 79.99,  quantity: 45, lowStockThreshold: 10, description: 'Over-ear noise-cancelling headphones.' },
  { id: 'p2', name: 'Leather Wallet',        category: 'Accessories',  price: 24.99,  quantity: 3,  lowStockThreshold: 5,  description: 'Slim genuine leather bifold wallet.' },
  { id: 'p3', name: 'Blue Denim Jacket',     category: 'Clothing',     price: 59.99,  quantity: 12, lowStockThreshold: 8,  description: 'Classic slim-fit denim jacket.' },
  { id: 'p4', name: 'Ceramic Coffee Mug',    category: 'Homeware',     price: 8.99,   quantity: 0,  lowStockThreshold: 5,  description: '350ml ceramic mug with handle.' },
  { id: 'p5', name: 'Running Shoes',         category: 'Footwear',     price: 89.99,  quantity: 7,  lowStockThreshold: 10, description: 'Lightweight mesh road runners.' },
  { id: 'p6', name: 'Mechanical Keyboard',   category: 'Electronics',  price: 129.99, quantity: 22, lowStockThreshold: 5,  description: 'Tenkeyless tactile switch keyboard.' },
  { id: 'p7', name: 'Polarised Sunglasses',  category: 'Accessories',  price: 34.99,  quantity: 2,  lowStockThreshold: 5,  description: 'UV400 polarised lenses.' },
  { id: 'p8', name: 'Yoga Mat',              category: 'Sports',       price: 29.99,  quantity: 18, lowStockThreshold: 6,  description: 'Non-slip 6mm thick exercise mat.' },
  { id: 'p9', name: 'Stainless Bottle',      category: 'Sports',       price: 19.99,  quantity: 31, lowStockThreshold: 8,  description: '750ml double-wall insulated bottle.' },
  { id:'p10', name: 'Desk Lamp',             category: 'Homeware',     price: 44.99,  quantity: 9,  lowStockThreshold: 4,  description: 'LED adjustable arm desk lamp.' },
];

function makeSaleId() { return 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const SEED_SALES = [
  { id:'s1',  invoiceNumber:'INV-940271', customerName:'Amara Osei',      items:[{productId:'p1',productName:'Wireless Headphones',quantity:2,unitPrice:79.99,lineTotal:159.98},{productId:'p8',productName:'Yoga Mat',quantity:1,unitPrice:29.99,lineTotal:29.99}], subtotal:189.97, tax:37.99, grandTotal:227.96, saleDate:'', createdAt: daysAgo(0) },
  { id:'s2',  invoiceNumber:'INV-831045', customerName:'Fletcher Hayes',  items:[{productId:'p6',productName:'Mechanical Keyboard',quantity:1,unitPrice:129.99,lineTotal:129.99}],                                                                                    subtotal:129.99, tax:26.00, grandTotal:155.99, saleDate:'', createdAt: daysAgo(1) },
  { id:'s3',  invoiceNumber:'INV-762893', customerName:'Walk-in',         items:[{productId:'p2',productName:'Leather Wallet',quantity:1,unitPrice:24.99,lineTotal:24.99},{productId:'p7',productName:'Polarised Sunglasses',quantity:1,unitPrice:34.99,lineTotal:34.99}], subtotal:59.98, tax:12.00, grandTotal:71.98, saleDate:'', createdAt: daysAgo(1) },
  { id:'s4',  invoiceNumber:'INV-653417', customerName:'Zara Ndiaye',     items:[{productId:'p3',productName:'Blue Denim Jacket',quantity:1,unitPrice:59.99,lineTotal:59.99},{productId:'p5',productName:'Running Shoes',quantity:1,unitPrice:89.99,lineTotal:89.99}],     subtotal:149.98, tax:30.00, grandTotal:179.98, saleDate:'', createdAt: daysAgo(2) },
  { id:'s5',  invoiceNumber:'INV-584230', customerName:'Lucas Brennan',   items:[{productId:'p9',productName:'Stainless Bottle',quantity:3,unitPrice:19.99,lineTotal:59.97},{productId:'p8',productName:'Yoga Mat',quantity:2,unitPrice:29.99,lineTotal:59.98}],            subtotal:119.95, tax:24.00, grandTotal:143.94, saleDate:'', createdAt: daysAgo(3) },
  { id:'s6',  invoiceNumber:'INV-471865', customerName:'Priya Iyer',      items:[{productId:'p10',productName:'Desk Lamp',quantity:1,unitPrice:44.99,lineTotal:44.99},{productId:'p4',productName:'Ceramic Coffee Mug',quantity:2,unitPrice:8.99,lineTotal:17.98}],        subtotal:62.97, tax:12.60, grandTotal:75.57, saleDate:'', createdAt: daysAgo(4) },
  { id:'s7',  invoiceNumber:'INV-398542', customerName:'Marcus Thornton', items:[{productId:'p1',productName:'Wireless Headphones',quantity:1,unitPrice:79.99,lineTotal:79.99}],                                                                                    subtotal:79.99, tax:16.00, grandTotal:95.99, saleDate:'', createdAt: daysAgo(5) },
  { id:'s8',  invoiceNumber:'INV-274316', customerName:'Isla MacDonald',  items:[{productId:'p5',productName:'Running Shoes',quantity:2,unitPrice:89.99,lineTotal:179.98},{productId:'p9',productName:'Stainless Bottle',quantity:1,unitPrice:19.99,lineTotal:19.99}],      subtotal:199.97, tax:40.00, grandTotal:239.96, saleDate:'', createdAt: daysAgo(8) },
  { id:'s9',  invoiceNumber:'INV-163784', customerName:'Emeka Eze',       items:[{productId:'p3',productName:'Blue Denim Jacket',quantity:2,unitPrice:59.99,lineTotal:119.98}],                                                                                     subtotal:119.98, tax:24.00, grandTotal:143.97, saleDate:'', createdAt: daysAgo(10) },
  { id:'s10', invoiceNumber:'INV-052941', customerName:'Chloe Dupont',    items:[{productId:'p6',productName:'Mechanical Keyboard',quantity:2,unitPrice:129.99,lineTotal:259.98},{productId:'p10',productName:'Desk Lamp',quantity:1,unitPrice:44.99,lineTotal:44.99}],     subtotal:304.97, tax:61.00, grandTotal:365.96, saleDate:'', createdAt: daysAgo(14) },
  { id:'s11', invoiceNumber:'INV-948203', customerName:'Walk-in',         items:[{productId:'p2',productName:'Leather Wallet',quantity:2,unitPrice:24.99,lineTotal:49.98}],                                                                                         subtotal:49.98, tax:10.00, grandTotal:59.97, saleDate:'', createdAt: daysAgo(17) },
  { id:'s12', invoiceNumber:'INV-837561', customerName:'Tariq Hassan',    items:[{productId:'p8',productName:'Yoga Mat',quantity:1,unitPrice:29.99,lineTotal:29.99},{productId:'p9',productName:'Stainless Bottle',quantity:2,unitPrice:19.99,lineTotal:39.98}],            subtotal:69.97, tax:14.00, grandTotal:83.96, saleDate:'', createdAt: daysAgo(21) },
  { id:'s13', invoiceNumber:'INV-726408', customerName:'Nina Voronova',   items:[{productId:'p1',productName:'Wireless Headphones',quantity:1,unitPrice:79.99,lineTotal:79.99},{productId:'p6',productName:'Mechanical Keyboard',quantity:1,unitPrice:129.99,lineTotal:129.99}], subtotal:209.98, tax:42.00, grandTotal:251.97, saleDate:'', createdAt: daysAgo(24) },
  { id:'s14', invoiceNumber:'INV-615329', customerName:'Ben Okafor',      items:[{productId:'p3',productName:'Blue Denim Jacket',quantity:1,unitPrice:59.99,lineTotal:59.99},{productId:'p7',productName:'Polarised Sunglasses',quantity:2,unitPrice:34.99,lineTotal:69.98}], subtotal:129.97, tax:26.00, grandTotal:155.96, saleDate:'', createdAt: daysAgo(27) },
];

// ── Init (seed if empty) ────────────────────────────────────

export function initStore() {
  if (!localStorage.getItem(KEYS.products)) {
    localStorage.setItem(KEYS.products, JSON.stringify(SEED_PRODUCTS));
  }
  if (!localStorage.getItem(KEYS.sales)) {
    localStorage.setItem(KEYS.sales, JSON.stringify(SEED_SALES));
  }
}

// ── Auth ────────────────────────────────────────────────────

export function getUser() {
  const raw = localStorage.getItem(KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export function login(email, password) {
  // Simple fake auth — any non-empty credentials work in dev mode
  if (!email || !password) throw new Error('Enter email and password.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const user = { name, email };
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  return user;
}

export function register(firstName, lastName, email, password) {
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const user = { name: `${firstName} ${lastName}`, email };
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(KEYS.user);
}

// ── Products ─────────────────────────────────────────────────

export function getProducts() {
  return JSON.parse(localStorage.getItem(KEYS.products) || '[]');
}

export function saveProduct(data) {
  const products = getProducts();
  if (data.id) {
    // Update
    const idx = products.findIndex(p => p.id === data.id);
    if (idx > -1) products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
  } else {
    // Create
    products.push({ ...data, id: 'p_' + Date.now(), createdAt: new Date().toISOString() });
  }
  localStorage.setItem(KEYS.products, JSON.stringify(products));
}

export function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  localStorage.setItem(KEYS.products, JSON.stringify(products));
}

export function decrementStock(productId, qty) {
  const products = getProducts();
  const p = products.find(p => p.id === productId);
  if (p) p.quantity = Math.max(0, p.quantity - qty);
  localStorage.setItem(KEYS.products, JSON.stringify(products));
}

// ── Sales ────────────────────────────────────────────────────

export function getSales() {
  return JSON.parse(localStorage.getItem(KEYS.sales) || '[]')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function saveSale(data) {
  const sales = getSales();
  const sale  = { ...data, id: makeSaleId(), createdAt: new Date().toISOString() };
  sales.push(sale);
  localStorage.setItem(KEYS.sales, JSON.stringify(sales));
  return sale;
}
