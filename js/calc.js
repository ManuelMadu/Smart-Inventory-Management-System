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

  // ── Smart / predictive analytics ──────────────────────────
  //
  // These functions turn the raw sales + product history into
  // forward-looking signals: how fast each product sells, when it
  // will run out, what to reorder, which lines are dead weight, and
  // a handful of plain-English insights for the dashboard. They stay
  // pure so they can be unit-tested without Firebase or a clock.

  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }
  function fmtMoney(x) { return (x || 0).toFixed(2); }

  function daysAgo(now, days) {
    var d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  }

  /**
   * Sums the revenue of sales whose createdAt falls in the half-open
   * window [now - toDaysAgo, now - fromDaysAgo). Used to compare one
   * period against another (e.g. this week vs last week).
   * @param {Array<{createdAt:string, grandTotal:number}>} sales
   * @param {Date} now
   * @param {number} fromDaysAgo - newer edge of the window (0 = now)
   * @param {number} toDaysAgo - older edge of the window
   * @returns {number}
   */
  function revenueInWindow(sales, now, fromDaysAgo, toDaysAgo) {
    var n     = now instanceof Date ? now : new Date(now);
    var start = daysAgo(n, toDaysAgo);
    var end   = daysAgo(n, fromDaysAgo);
    return sales.reduce(function(sum, s) {
      var d = new Date(s.createdAt);
      return (d >= start && d < end) ? sum + (s.grandTotal || 0) : sum;
    }, 0);
  }

  /**
   * Average units sold per day for one product over the trailing
   * windowDays. This is the "sales velocity" every forecast builds on.
   * @param {Array<{createdAt:string, items:Array<{productId:string, quantity:number}>}>} sales
   * @param {string} productId
   * @param {number} windowDays - lookback length (must be > 0)
   * @param {Date} now - reference point for "today"
   * @returns {number} units per day (0 if nothing sold or window invalid)
   */
  function calcSalesVelocity(sales, productId, windowDays, now) {
    if (!windowDays || windowDays <= 0) return 0;
    var n      = now instanceof Date ? now : new Date(now);
    var cutoff = daysAgo(n, windowDays);
    var units  = 0;
    sales.forEach(function(s) {
      if (new Date(s.createdAt) < cutoff) return;
      (s.items || []).forEach(function(it) {
        if (it.productId === productId) units += (it.quantity || 0);
      });
    });
    return units / windowDays;
  }

  /**
   * How many days of stock remain at the current velocity.
   * Returns null when velocity is zero (no predictable stockout).
   * @param {number} quantity - units on hand
   * @param {number} velocity - units sold per day
   * @returns {number|null}
   */
  function daysUntilStockout(quantity, velocity) {
    if (!velocity || velocity <= 0) return null;
    return quantity / velocity;
  }

  /**
   * The headline "smart" feature: ranks the products that need
   * reordering before they hurt sales. For each product it derives a
   * velocity, a days-until-stockout estimate, an urgency, a short
   * human reason, and a suggested reorder quantity sized to cover the
   * supplier lead time plus a stock-cover buffer.
   *
   * Only products that actually need attention are returned, sorted
   * critical-first and then by soonest stockout.
   *
   * @param {Array<{id:string, name:string, quantity:number, lowStockThreshold:number}>} products
   * @param {Array} sales
   * @param {{now?:Date, windowDays?:number, leadTimeDays?:number, coverDays?:number}} [opts]
   * @returns {Array<{id, name, quantity, velocity, daysUntilStockout:number|null, suggestedQty, urgency:'critical'|'warning', reason}>}
   */
  function calcReorderSuggestions(products, sales, opts) {
    opts = opts || {};
    var now          = opts.now instanceof Date ? opts.now : (opts.now ? new Date(opts.now) : new Date());
    var windowDays   = opts.windowDays   || 30;
    var leadTimeDays = opts.leadTimeDays || 7;
    var coverDays    = opts.coverDays    || 14;

    var out = [];

    products.forEach(function(p) {
      var velocity  = calcSalesVelocity(sales, p.id, windowDays, now);
      var dus       = daysUntilStockout(p.quantity, velocity);
      var threshold = p.lowStockThreshold || 0;

      var needs = false, urgency = '', reason = '';

      if (p.quantity === 0) {
        needs = true; urgency = 'critical';
        reason = velocity > 0 ? 'Out of stock — was selling ~' + round1(velocity) + '/day' : 'Out of stock';
      } else if (dus !== null && dus <= leadTimeDays) {
        needs   = true;
        urgency = dus <= leadTimeDays / 2 ? 'critical' : 'warning';
        var d   = Math.round(dus);
        reason  = 'Runs out in ~' + d + ' day' + (d === 1 ? '' : 's');
      } else if (p.quantity <= threshold) {
        needs = true; urgency = 'warning';
        reason = velocity > 0 ? 'Below restock level' : 'Below restock level — no recent sales';
      }

      if (!needs) return;

      // Reorder up to (lead time + cover) days of demand, net of stock on hand.
      // With no measured velocity, fall back to twice the restock threshold.
      var target       = velocity > 0 ? Math.ceil(velocity * (leadTimeDays + coverDays))
                                       : Math.max(threshold * 2, 1);
      var suggestedQty = Math.max(1, target - p.quantity);

      out.push({
        id:                p.id,
        name:              p.name,
        quantity:          p.quantity,
        velocity:          round2(velocity),
        daysUntilStockout: dus === null ? null : round1(dus),
        suggestedQty:      suggestedQty,
        urgency:           urgency,
        reason:            reason,
      });
    });

    var rank = { critical: 0, warning: 1 };
    return out.sort(function(a, b) {
      if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
      var da = a.daysUntilStockout === null ? Infinity : a.daysUntilStockout;
      var db = b.daysUntilStockout === null ? Infinity : b.daysUntilStockout;
      return da - db;
    });
  }

  /**
   * Products sitting in stock that have not sold at all within the
   * trailing `days` window — capital tied up in dead weight.
   * @param {Array<{id:string, quantity:number}>} products
   * @param {Array} sales
   * @param {Date} now
   * @param {number} days - inactivity window (default 30)
   * @returns {Array}
   */
  function findDeadStock(products, sales, now, days) {
    var window = days || 30;
    var n      = now instanceof Date ? now : new Date(now);
    var cutoff = daysAgo(n, window);
    var sold   = {};
    sales.forEach(function(s) {
      if (new Date(s.createdAt) < cutoff) return;
      (s.items || []).forEach(function(it) { if (it.productId) sold[it.productId] = true; });
    });
    return products.filter(function(p) { return p.quantity > 0 && !sold[p.id]; });
  }

  /**
   * ABC (Pareto) analysis: classifies every product that has sold into
   * tiers by revenue contribution. A = the vital few making up the
   * first 80% of revenue, B = the next 15%, C = the trailing 5%. The
   * item that straddles a boundary stays in the more important tier.
   * @param {Array<{items:Array<{productId:string, productName:string, quantity:number, lineTotal:number}>}>} sales
   * @param {Array<{id:string, name:string}>} products - for current names
   * @returns {Array<{id, name, revenue, units, share, cumulativeShare, class:'A'|'B'|'C'}>}
   */
  function calcAbcAnalysis(sales, products) {
    var nameById = {};
    (products || []).forEach(function(p) { nameById[p.id] = p.name; });

    var agg = {};
    sales.forEach(function(s) {
      (s.items || []).forEach(function(it) {
        var key = it.productId || it.productName;
        if (!agg[key]) {
          agg[key] = {
            id:      it.productId || null,
            name:    nameById[it.productId] || it.productName || 'Unknown',
            revenue: 0,
            units:   0,
          };
        }
        agg[key].revenue += (it.lineTotal || 0);
        agg[key].units   += (it.quantity  || 0);
      });
    });

    var rows = Object.keys(agg).map(function(k) { return agg[k]; })
      .sort(function(a, b) { return b.revenue - a.revenue; });

    var total     = rows.reduce(function(s, r) { return s + r.revenue; }, 0);
    var cumBefore = 0;
    rows.forEach(function(r) {
      r.share = total > 0 ? r.revenue / total : 0;
      if (total <= 0) { r.class = 'C'; r.cumulativeShare = 0; return; }
      r.class = cumBefore < 0.8 - 1e-9 ? 'A' : (cumBefore < 0.95 - 1e-9 ? 'B' : 'C');
      cumBefore += r.share;
      r.cumulativeShare = cumBefore;
    });

    return rows;
  }

  /**
   * Builds a prioritised list of plain-English insight cards for the
   * dashboard from the same product + sales data. Each card is
   * { type, severity, icon, title, text }; severity drives colour
   * ('good' | 'warning' | 'critical' | 'info'). Only insights that the
   * data actually supports are emitted, most important first.
   * @param {Array} products
   * @param {Array} sales
   * @param {{now?:Date, windowDays?:number, leadTimeDays?:number, deadDays?:number}} [opts]
   * @returns {Array<{type, severity, icon, title, text}>}
   */
  function generateInsights(products, sales, opts) {
    opts = opts || {};
    var now          = opts.now instanceof Date ? opts.now : (opts.now ? new Date(opts.now) : new Date());
    var windowDays   = opts.windowDays   || 30;
    var leadTimeDays = opts.leadTimeDays || 7;
    var deadDays     = opts.deadDays     || 30;

    var insights = [];

    // 1. Week-over-week revenue trend.
    var rev     = revenueInWindow(sales, now, 0, 7);
    var prevRev = revenueInWindow(sales, now, 7, 14);
    if (rev > 0 || prevRev > 0) {
      if (prevRev > 0) {
        var pct = Math.round(((rev - prevRev) / prevRev) * 100);
        if (pct >= 5) {
          insights.push({ type: 'revenue', severity: 'good', icon: 'trend-up',
            title: 'Revenue is up ' + pct + '%',
            text: 'You made £' + fmtMoney(rev) + ' this week vs £' + fmtMoney(prevRev) + ' the week before.' });
        } else if (pct <= -5) {
          insights.push({ type: 'revenue', severity: 'warning', icon: 'trend-down',
            title: 'Revenue is down ' + Math.abs(pct) + '%',
            text: '£' + fmtMoney(rev) + ' this week vs £' + fmtMoney(prevRev) + ' the week before.' });
        } else {
          insights.push({ type: 'revenue', severity: 'info', icon: 'minus',
            title: 'Revenue is holding steady',
            text: '£' + fmtMoney(rev) + ' this week, about level with last week.' });
        }
      } else {
        insights.push({ type: 'revenue', severity: 'good', icon: 'trend-up',
          title: 'Sales are picking up',
          text: '£' + fmtMoney(rev) + ' this week after a quiet week before.' });
      }
    }

    // 2. Products about to run out (within the supplier lead time).
    var sugg = calcReorderSuggestions(products, sales, { now: now, windowDays: windowDays, leadTimeDays: leadTimeDays });
    var soon = sugg.filter(function(s) { return s.daysUntilStockout !== null && s.daysUntilStockout <= leadTimeDays; });
    if (soon.length) {
      var lead = soon[0];
      insights.push({ type: 'stockout', severity: 'critical', icon: 'warning',
        title: soon.length === 1 ? lead.name + ' is running out' : soon.length + ' products are running out',
        text: soon.length === 1
          ? '~' + lead.daysUntilStockout + ' days of stock left at the current pace — reorder ~' + lead.suggestedQty + ' units.'
          : lead.name + ' is first (~' + lead.daysUntilStockout + ' days left). Reorder before they sell out.' });
    }

    // 3. Already out of stock — actively losing sales.
    var oos = products.filter(function(p) { return p.quantity === 0; });
    if (oos.length) {
      insights.push({ type: 'oos', severity: 'critical', icon: 'x-circle',
        title: oos.length + (oos.length > 1 ? ' products are out of stock' : ' product is out of stock'),
        text: 'Restock to stop losing sales: ' + oos.slice(0, 3).map(function(p) { return p.name; }).join(', ') + (oos.length > 3 ? '…' : '') + '.' });
    }

    // 4. Top seller of the week.
    var weekSales = sales.filter(function(s) { return new Date(s.createdAt) >= daysAgo(now, 7); });
    var best      = prepareBestSellingItems(weekSales, 1);
    if (best.length && best[0][1].units > 0) {
      insights.push({ type: 'topseller', severity: 'good', icon: 'star',
        title: best[0][0] + ' is your top seller',
        text: best[0][1].units + ' units sold this week — £' + fmtMoney(best[0][1].revenue) + ' in revenue.' });
    }

    // 5. Dead stock dragging on capital.
    var dead = findDeadStock(products, sales, now, deadDays);
    if (dead.length) {
      insights.push({ type: 'deadstock', severity: 'warning', icon: 'package',
        title: dead.length + (dead.length > 1 ? ' items are not selling' : ' item is not selling'),
        text: 'No sales in ' + deadDays + ' days: ' + dead.slice(0, 3).map(function(p) { return p.name; }).join(', ') + (dead.length > 3 ? '…' : '') + '. Consider a promotion.' });
    }

    return insights;
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
    calcSalesVelocity,
    daysUntilStockout,
    calcReorderSuggestions,
    findDeadStock,
    calcAbcAnalysis,
    generateInsights,
  };

  if (typeof window !== 'undefined') window.StockWiseCalc = StockWiseCalc;
  if (typeof module !== 'undefined' && module.exports) module.exports = StockWiseCalc;

})();
