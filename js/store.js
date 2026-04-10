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
