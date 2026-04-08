/**
 * StockWise — Firebase store
 * Requires firebase-app-compat, firebase-auth-compat, firebase-firestore-compat
 * loaded before this script.
 */

(function () {

  // ── Firebase init ─────────────────────────────────────────
  const firebaseConfig = {
    apiKey:            "AIzaSyCfx5FY-2svQvHSaxJKT8F6kDNIOU-Ow08",
    authDomain:        "stockwise-7a8cb.firebaseapp.com",
    projectId:         "stockwise-7a8cb",
    storageBucket:     "stockwise-7a8cb.firebasestorage.app",
    messagingSenderId: "55269769301",
    appId:             "1:55269769301:web:b9467f5c683bfe7ab214dc"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  var auth = firebase.auth();
  var db   = firebase.firestore();

  window.auth = auth;
  window.db   = db;

  // ── Helpers ───────────────────────────────────────────────

  function userCol(name) {
    var uid = auth.currentUser && auth.currentUser.uid;
    if (!uid) throw new Error('Not signed in.');
    return db.collection('users').doc(uid).collection(name);
  }

  function tsToISO(ts) {
    if (!ts) return new Date().toISOString();
    if (ts.toDate) return ts.toDate().toISOString();
    return ts;
  }

  function getFriendlyError(err) {
    var code = err.code || '';
    if (code === 'auth/invalid-credential'  || code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'       || code === 'auth/invalid-email') {
      return 'Invalid email or password.';
    }
    if (code === 'auth/email-already-in-use') return 'An account with that email already exists.';
    if (code === 'auth/weak-password')        return 'Password must be at least 6 characters.';
    if (code === 'auth/too-many-requests')    return 'Too many attempts. Try again later.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your connection.';
    return err.message || 'Something went wrong.';
  }

  window.getFriendlyError = getFriendlyError;

  // ── Seed data ─────────────────────────────────────────────

  var SEED_PRODUCTS = [
    { id:'p1',  name:'Wireless Headphones', category:'Electronics', price:79.99,  quantity:45, lowStockThreshold:10, description:'Over-ear noise-cancelling headphones.' },
    { id:'p2',  name:'Leather Wallet',       category:'Accessories', price:24.99,  quantity:3,  lowStockThreshold:5,  description:'Slim genuine leather bifold wallet.' },
    { id:'p3',  name:'Blue Denim Jacket',    category:'Clothing',    price:59.99,  quantity:12, lowStockThreshold:8,  description:'Classic slim-fit denim jacket.' },
    { id:'p4',  name:'Ceramic Coffee Mug',   category:'Homeware',    price:8.99,   quantity:0,  lowStockThreshold:5,  description:'350ml ceramic mug with handle.' },
    { id:'p5',  name:'Running Shoes',        category:'Footwear',    price:89.99,  quantity:7,  lowStockThreshold:10, description:'Lightweight mesh road runners.' },
    { id:'p6',  name:'Mechanical Keyboard',  category:'Electronics', price:129.99, quantity:22, lowStockThreshold:5,  description:'Tenkeyless tactile switch keyboard.' },
    { id:'p7',  name:'Polarised Sunglasses', category:'Accessories', price:34.99,  quantity:2,  lowStockThreshold:5,  description:'UV400 polarised lenses.' },
    { id:'p8',  name:'Yoga Mat',             category:'Sports',      price:29.99,  quantity:18, lowStockThreshold:6,  description:'Non-slip 6mm thick exercise mat.' },
    { id:'p9',  name:'Stainless Bottle',     category:'Sports',      price:19.99,  quantity:31, lowStockThreshold:8,  description:'750ml double-wall insulated bottle.' },
    { id:'p10', name:'Desk Lamp',            category:'Homeware',    price:44.99,  quantity:9,  lowStockThreshold:4,  description:'LED adjustable arm desk lamp.' },
  ];

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  var SEED_SALES = [
    { id:'s1',  invoiceNumber:'INV-940271', customerName:'Amara Osei',      items:[{productId:'p1',productName:'Wireless Headphones',quantity:2,unitPrice:79.99,lineTotal:159.98},{productId:'p8',productName:'Yoga Mat',quantity:1,unitPrice:29.99,lineTotal:29.99}], subtotal:189.97, tax:37.99, grandTotal:227.96, saleDate:'', createdAt:daysAgo(0) },
    { id:'s2',  invoiceNumber:'INV-831045', customerName:'Fletcher Hayes',  items:[{productId:'p6',productName:'Mechanical Keyboard',quantity:1,unitPrice:129.99,lineTotal:129.99}], subtotal:129.99, tax:26.00, grandTotal:155.99, saleDate:'', createdAt:daysAgo(1) },
    { id:'s3',  invoiceNumber:'INV-762893', customerName:'Walk-in',         items:[{productId:'p2',productName:'Leather Wallet',quantity:1,unitPrice:24.99,lineTotal:24.99},{productId:'p7',productName:'Polarised Sunglasses',quantity:1,unitPrice:34.99,lineTotal:34.99}], subtotal:59.98, tax:12.00, grandTotal:71.98, saleDate:'', createdAt:daysAgo(1) },
    { id:'s4',  invoiceNumber:'INV-653417', customerName:'Zara Ndiaye',     items:[{productId:'p3',productName:'Blue Denim Jacket',quantity:1,unitPrice:59.99,lineTotal:59.99},{productId:'p5',productName:'Running Shoes',quantity:1,unitPrice:89.99,lineTotal:89.99}], subtotal:149.98, tax:30.00, grandTotal:179.98, saleDate:'', createdAt:daysAgo(2) },
    { id:'s5',  invoiceNumber:'INV-584230', customerName:'Lucas Brennan',   items:[{productId:'p9',productName:'Stainless Bottle',quantity:3,unitPrice:19.99,lineTotal:59.97},{productId:'p8',productName:'Yoga Mat',quantity:2,unitPrice:29.99,lineTotal:59.98}], subtotal:119.95, tax:24.00, grandTotal:143.94, saleDate:'', createdAt:daysAgo(3) },
    { id:'s6',  invoiceNumber:'INV-471865', customerName:'Priya Iyer',      items:[{productId:'p10',productName:'Desk Lamp',quantity:1,unitPrice:44.99,lineTotal:44.99},{productId:'p4',productName:'Ceramic Coffee Mug',quantity:2,unitPrice:8.99,lineTotal:17.98}], subtotal:62.97, tax:12.60, grandTotal:75.57, saleDate:'', createdAt:daysAgo(4) },
    { id:'s7',  invoiceNumber:'INV-398542', customerName:'Marcus Thornton', items:[{productId:'p1',productName:'Wireless Headphones',quantity:1,unitPrice:79.99,lineTotal:79.99}], subtotal:79.99, tax:16.00, grandTotal:95.99, saleDate:'', createdAt:daysAgo(5) },
    { id:'s8',  invoiceNumber:'INV-274316', customerName:'Isla MacDonald',  items:[{productId:'p5',productName:'Running Shoes',quantity:2,unitPrice:89.99,lineTotal:179.98},{productId:'p9',productName:'Stainless Bottle',quantity:1,unitPrice:19.99,lineTotal:19.99}], subtotal:199.97, tax:40.00, grandTotal:239.96, saleDate:'', createdAt:daysAgo(8) },
    { id:'s9',  invoiceNumber:'INV-163784', customerName:'Emeka Eze',       items:[{productId:'p3',productName:'Blue Denim Jacket',quantity:2,unitPrice:59.99,lineTotal:119.98}], subtotal:119.98, tax:24.00, grandTotal:143.97, saleDate:'', createdAt:daysAgo(10) },
    { id:'s10', invoiceNumber:'INV-052941', customerName:'Chloe Dupont',    items:[{productId:'p6',productName:'Mechanical Keyboard',quantity:2,unitPrice:129.99,lineTotal:259.98},{productId:'p10',productName:'Desk Lamp',quantity:1,unitPrice:44.99,lineTotal:44.99}], subtotal:304.97, tax:61.00, grandTotal:365.96, saleDate:'', createdAt:daysAgo(14) },
  ];

  async function seedUserData(uid) {
    var batch = db.batch();
    SEED_PRODUCTS.forEach(function(p) {
      var ref = db.collection('users').doc(uid).collection('products').doc(p.id);
      batch.set(ref, { name:p.name, category:p.category, price:p.price, quantity:p.quantity, lowStockThreshold:p.lowStockThreshold, description:p.description, createdAt:new Date().toISOString() });
    });
    SEED_SALES.forEach(function(s) {
      var ref = db.collection('users').doc(uid).collection('sales').doc(s.id);
      batch.set(ref, s);
    });
    await batch.commit();
  }

  // ── Auth ──────────────────────────────────────────────────

  window.initStore = function() {};  // no-op, kept for compatibility

  window.login = async function(email, password) {
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      throw new Error(getFriendlyError(err));
    }
  };

  window.register = async function(firstName, lastName, email, password) {
    try {
      var cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: firstName + ' ' + lastName });
      await db.collection('users').doc(cred.user.uid).set({ firstName:firstName, lastName:lastName, email:email, createdAt:new Date().toISOString() });
      await seedUserData(cred.user.uid);
    } catch (err) {
      throw new Error(getFriendlyError(err));
    }
  };

  window.logout = async function() {
    await auth.signOut();
  };

  window.getUser = function() {
    var u = auth.currentUser;
    if (!u) return null;
    return { name: u.displayName || u.email, email: u.email, uid: u.uid };
  };

  // ── Products ──────────────────────────────────────────────

  window.getProducts = async function() {
    var snap = await userCol('products').get();
    return snap.docs.map(function(d) {
      return Object.assign({ id: d.id }, d.data());
    });
  };

  window.saveProduct = async function(data) {
    if (data.id) {
      var id  = data.id;
      var rest = Object.assign({}, data);
      delete rest.id;
      rest.updatedAt = new Date().toISOString();
      await userCol('products').doc(id).update(rest);
    } else {
      var newData = Object.assign({}, data);
      delete newData.id;
      newData.createdAt = new Date().toISOString();
      await userCol('products').add(newData);
    }
  };

  window.deleteProduct = async function(id) {
    await userCol('products').doc(id).delete();
  };

  window.decrementStock = async function(productId, qty) {
    var ref = userCol('products').doc(productId);
    var doc = await ref.get();
    if (doc.exists) {
      var current = doc.data().quantity || 0;
      await ref.update({ quantity: Math.max(0, current - qty) });
    }
  };

  // ── Sales ─────────────────────────────────────────────────

  window.getSales = async function() {
    var snap = await userCol('sales').get();
    return snap.docs.map(function(d) {
      var data = d.data();
      return Object.assign({ id: d.id }, data, { createdAt: tsToISO(data.createdAt) });
    }).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  };

  window.saveSale = async function(data) {
    var saleData = Object.assign({}, data, { createdAt: new Date().toISOString() });
    var ref = await userCol('sales').add(saleData);
    return Object.assign({ id: ref.id }, saleData);
  };

})();
