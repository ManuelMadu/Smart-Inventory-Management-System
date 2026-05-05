/**
 * StockWise — Pure calculation functions.
 * Exposed as window.StockWiseCalc in the browser and module.exports in Node.
 *
 * Every function is pure: same inputs always produce the same outputs.
 * No DOM access, no Firebase calls, no mutation of input arguments.
 */
(function () {
  'use strict';

  // ── Dashboard ─────────────────────────────────────────────

  /**
   * Computes the three headline stats shown on the dashboard.
   * @param {Array<{quantity:number, lowStockThreshold:number}>} products
   * @param {Array<{createdAt:string, grandTotal:number}>} sales
   * @param {Date} now - reference point used to determine the current month
   * @returns {{lowStockCount:number, monthlySalesCount:number, monthlyRevenue:number}}
   */
  function calcDashboardStats(products, sales, now) {
    var n          = now instanceof Date ? now : new Date(now);
    var monthStart = new Date(n.getFullYear(), n.getMonth(), 1);
    var lowStock   = products.filter(function(p) { return p.quantity <= p.lowStockThreshold; });
    var moSales    = sales.filter(function(s) { return new Date(s.createdAt) >= monthStart; });
    var revenue    = moSales.reduce(function(sum, s) { return sum + (s.grandTotal || 0); }, 0);
    return {
      lowStockCount:     lowStock.length,
      monthlySalesCount: moSales.length,
      monthlyRevenue:    revenue,
    };
  }

  /**
   * Returns products whose quantity is at or below their low-stock threshold,
   * sorted by quantity ascending (most critical first).
   * @param {Array<{quantity:number, lowStockThreshold:number}>} products
   * @returns {Array}
   */
  function filterLowStock(products) {
    return products
      .filter(function(p) { return p.quantity <= p.lowStockThreshold; })
      .sort(function(a, b) { return a.quantity - b.quantity; });
  }

  /**
   * Buckets total revenue into the last 7 days (today plus the 6 days before it).
   * Labels use the short weekday + day format: "Mon 4".
   * Day matching is done via toDateString() — local-timezone aware.
   * @param {Array<{createdAt:string, grandTotal:number}>} sales
   * @param {Date} now - reference date for "today"
   * @returns {{labels:string[], data:number[]}}
   */
  function bucketRevenueByDay(sales, now) {
    var today  = now instanceof Date ? now : new Date(now);
    var labels = [];
    var data   = [];
    for (let i = 6; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }));
      var rev = sales
        .filter(function(s) { return new Date(s.createdAt).toDateString() === d.toDateString(); })
        .reduce(function(sum, s) { return sum + (s.grandTotal || 0); }, 0);
      data.push(rev);
    }
    return { labels: labels, data: data };
  }

  /**
   * Returns the top-N products ranked by quantity descending.
   * @param {Array<{quantity:number}>} products
   * @param {number} [limit=7]
   * @returns {Array}
   */
  function rankProductsByStock(products, limit) {
    var n = limit !== undefined ? limit : 7;
    return products.slice().sort(function(a, b) { return b.quantity - a.quantity; }).slice(0, n);
  }

  // ── Products ──────────────────────────────────────────────

  /**
   * Filters a product array by free-text search, exact category match, and
   * stock-level status ('out' | 'low' | 'ok' | '' for any).
   * The search term is matched case-insensitively against name and category.
   * @param {Array<{name:string, category:string, quantity:number, lowStockThreshold:number}>} products
   * @param {string} search
   * @param {string} category - exact match; '' means any
   * @param {string} status - 'out' | 'low' | 'ok' | '' for any
   * @returns {Array}
   */
  function filterProducts(products, search, category, status) {
    var q = (search || '').toLowerCase();
    return products.filter(function(p) {
      var ms = !q        || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
      var mc = !category || p.category === category;
      var mv = !status   ||
        (status === 'out' && p.quantity === 0) ||
        (status === 'low' && p.quantity > 0 && p.quantity <= p.lowStockThreshold) ||
        (status === 'ok'  && p.quantity > p.lowStockThreshold);
      return ms && mc && mv;
    });
  }

  /**
   * Classifies the stock level of a single product.
   * 'lo' = out of stock (qty === 0)
   * 'mid' = low stock (0 < qty <= threshold)
   * 'hi' = in stock (qty > threshold)
   * @param {{quantity:number, lowStockThreshold:number}} product
   * @returns {'lo'|'mid'|'hi'}
   */
  function stockLevel(product) {
    if (product.quantity === 0) return 'lo';
    if (product.quantity <= product.lowStockThreshold) return 'mid';
    return 'hi';
  }

  /**
   * Computes the stock-bar fill percentage (0–100) for a product.
   * The scale treats 3× the low-stock threshold as the visual maximum.
   * @param {{quantity:number, lowStockThreshold:number}} product
   * @returns {number}
   */
  function stockBarPct(product) {
    var max = Math.max(product.quantity, product.lowStockThreshold * 3, 1);
    return Math.min(100, (product.quantity / max) * 100);
  }

  // ── Sales ─────────────────────────────────────────────────

  /**
   * Calculates the line total for a single sale item.
   * @param {number} qty
   * @param {number} unitPrice
   * @returns {number}
   */
  function lineTotal(qty, unitPrice) {
    return qty * unitPrice;
  }

  /**
   * Derives VAT and grand total from a pre-computed subtotal using a fixed
   * 20 % rate. The caller is responsible for computing the subtotal from items.
   * @param {number} subtotal
   * @returns {{subtotal:number, tax:number, grandTotal:number}}
   */
  function calcSaleTotals(subtotal) {
    var tax = subtotal * 0.20;
    return { subtotal: subtotal, tax: tax, grandTotal: subtotal + tax };
  }

  /**
   * Formats a positive integer as an INV-prefixed invoice number string.
   * The caller owns the random-number generation so this function stays pure.
   * @param {number} n - positive integer
   * @returns {string} e.g. 'INV-123456'
   */
  function formatInvoiceNumber(n) {
    return 'INV-' + n;
  }

  /**
   * Checks that every item in a proposed sale can be fulfilled from the
   * available stock. Assumes the caller has already validated that productId
   * is non-empty and quantity >= 1.
   * @param {Array<{productId:string, quantity:number}>} items
   * @param {Array<{id:string, name:string, quantity:number}>} products
   * @returns {{valid:true, error:null}|{valid:false, error:string}}
   */
  function validateStockAvailability(items, products) {
    for (var i = 0; i < items.length; i++) {
      var item    = items[i];
      var product = null;
      for (var j = 0; j < products.length; j++) {
        if (products[j].id === item.productId) { product = products[j]; break; }
      }
      if (!product) return { valid: false, error: 'Product not found.' };
      if (item.quantity > product.quantity) {
        return {
          valid: false,
          error: 'Not enough stock for "' + product.name + '" — only ' + product.quantity + ' available.',
        };
      }
    }
    return { valid: true, error: null };
  }

  /**
   * Filters a sales array by a customer-name / invoice-number search term
   * and an ISO date string (YYYY-MM-DD). Both filters are optional ('' = any).
   * The date comparison is performed in UTC via toISOString().
   * @param {Array<{customerName:string, invoiceNumber:string, createdAt:string}>} sales
   * @param {string} search
   * @param {string} date - YYYY-MM-DD or ''
   * @returns {Array}
   */
  function filterSales(sales, search, date) {
    var q = (search || '').toLowerCase();
    return sales.filter(function(s) {
      var ms = !q    || (s.customerName || '').toLowerCase().includes(q) || s.invoiceNumber.toLowerCase().includes(q);
      var md = !date || new Date(s.createdAt).toISOString().split('T')[0] === date;
      return ms && md;
    });
  }

  // ── Reports ───────────────────────────────────────────────

  /**
   * Computes the four summary statistics shown at the top of the Reports page.
   * @param {Array<{grandTotal:number, items:Array<{quantity:number}>}>} sales
   * @returns {{revenue:number, salesCount:number, avgOrderValue:number, unitsSold:number}}
   */
  function calcReportStats(sales) {
    var revenue = sales.reduce(function(s, x) { return s + (x.grandTotal || 0); }, 0);
    var units   = sales.reduce(function(s, x) {
      return s + (x.items || []).reduce(function(u, i) { return u + (i.quantity || 0); }, 0);
    }, 0);
    var avg = sales.length ? revenue / sales.length : 0;
    return { revenue: revenue, salesCount: sales.length, avgOrderValue: avg, unitsSold: units };
  }

  /**
   * Builds revenue-over-time chart data for a given period.
   * Periods <= 30 days use daily buckets; longer periods use monthly buckets
   * spanning the 12 calendar months that end with the current month.
   * Daily labels: "4 May". Monthly labels: "May 25".
   * @param {Array<{createdAt:string, grandTotal:number}>} sales
   * @param {number} days - 7 | 30 | 90 | 365
   * @param {Date} now - reference date for "today"
   * @returns {{labels:string[], data:number[], subtitle:string}}
   */
  function bucketRevenueForPeriod(sales, days, now) {
    var today   = now instanceof Date ? now : new Date(now);
    var buckets = {};
    var subtitle;

    if (days <= 30) {
      for (let i = days - 1; i >= 0; i--) {
        var day = new Date(today);
        day.setDate(today.getDate() - i);
        buckets[day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })] = 0;
      }
      sales.forEach(function(s) {
        var sDay = new Date(s.createdAt);
        var key  = sDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        if (key in buckets) buckets[key] += (s.grandTotal || 0);
      });
      subtitle = 'Daily revenue — last ' + days + ' days';
    } else {
      for (let i = 11; i >= 0; i--) {
        var month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        buckets[month.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })] = 0;
      }
      sales.forEach(function(s) {
        var sMonth = new Date(s.createdAt);
        var key    = sMonth.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        if (key in buckets) buckets[key] += (s.grandTotal || 0);
      });
      subtitle = 'Monthly revenue — last 12 months';
    }

    return { labels: Object.keys(buckets), data: Object.values(buckets), subtitle: subtitle };
  }

  /**
   * Aggregates line-item revenue by product name and returns the top-N entries
   * sorted by total revenue descending.
   * @param {Array<{items:Array<{productName:string, lineTotal:number}>}>} sales
   * @param {number} [limit=8] - dashboard uses 7, reports uses 8 (intentional)
   * @returns {Array<[string, number]>} [productName, totalRevenue] pairs
   */
  function rankProductsByRevenue(sales, limit) {
    var n   = limit !== undefined ? limit : 8;
    var rev = {};
    sales.forEach(function(s) {
      (s.items || []).forEach(function(i) {
        rev[i.productName] = (rev[i.productName] || 0) + (i.lineTotal || 0);
      });
    });
    return Object.entries(rev).sort(function(a, b) { return b[1] - a[1]; }).slice(0, n);
  }

  /**
   * Aggregates line-item revenue by product category using a pre-built
   * productId → category lookup map. Unknown product IDs are grouped under
   * 'Uncategorised'. Returns all categories sorted by revenue descending.
   * @param {Array<{items:Array<{productId:string, lineTotal:number}>}>} sales
   * @param {Object<string,string>} prodCat - productId → category name
   * @returns {Array<[string, number]>} [category, totalRevenue] pairs
   */
  function aggregateCategoryRevenue(sales, prodCat) {
    var catRev = {};
    sales.forEach(function(s) {
      (s.items || []).forEach(function(i) {
        var cat = (prodCat && prodCat[i.productId]) || 'Uncategorised';
        catRev[cat] = (catRev[cat] || 0) + (i.lineTotal || 0);
      });
    });
    return Object.entries(catRev).sort(function(a, b) { return b[1] - a[1]; });
  }

  /**
   * Builds the best-selling items table data: aggregates units sold and
   * revenue per product name, then returns the top-N sorted by revenue desc.
   * @param {Array<{items:Array<{productName:string, quantity:number, lineTotal:number}>}>} sales
   * @param {number} [limit=10]
   * @returns {Array<[string, {units:number, revenue:number}]>}
   */
  function prepareBestSellingItems(sales, limit) {
    var n     = limit !== undefined ? limit : 10;
    var stats = {};
    sales.forEach(function(s) {
      (s.items || []).forEach(function(i) {
        if (!stats[i.productName]) stats[i.productName] = { units: 0, revenue: 0 };
        stats[i.productName].units   += (i.quantity  || 0);
        stats[i.productName].revenue += (i.lineTotal || 0);
      });
    });
    return Object.entries(stats).sort(function(a, b) { return b[1].revenue - a[1].revenue; }).slice(0, n);
  }

  // ── Export ────────────────────────────────────────────────

  var StockWiseCalc = {
    calcDashboardStats,
    filterLowStock,
    bucketRevenueByDay,
    rankProductsByStock,
    filterProducts,
    stockLevel,
    stockBarPct,
    lineTotal,
    calcSaleTotals,
    formatInvoiceNumber,
    validateStockAvailability,
    filterSales,
    calcReportStats,
    bucketRevenueForPeriod,
    rankProductsByRevenue,
    aggregateCategoryRevenue,
    prepareBestSellingItems,
  };

  if (typeof window !== 'undefined') window.StockWiseCalc = StockWiseCalc;
  if (typeof module !== 'undefined' && module.exports) module.exports = StockWiseCalc;

})();
