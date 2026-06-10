/**
 * StockWise — unit tests for js/calc.js
 * Run with: npm test
 */

const calc = require('../js/calc.js');

// ── Shared fixtures ───────────────────────────────────────
// Dates are constructed with the Date(year, month, day, h, m, s) form so
// they are local-timezone safe across any CI environment.

function isoLocal(year, month, day, hour = 12) {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

const NOW = new Date(2026, 4, 4); // May 4 2026 local

const PRODUCTS = [
  { id: 'p1', name: 'Widget A', category: 'Widgets', price: 10, quantity: 50, lowStockThreshold: 10 },
  { id: 'p2', name: 'Gadget B', category: 'Gadgets', price: 25, quantity:  5, lowStockThreshold: 10 },
  { id: 'p3', name: 'Widget C', category: 'Widgets', price: 15, quantity:  0, lowStockThreshold:  5 },
  { id: 'p4', name: 'Doohickey', category: 'Misc',   price:  8, quantity: 30, lowStockThreshold:  5 },
];

const SALES = [
  {
    id: 's1', invoiceNumber: 'INV-111111', customerName: 'Alice',
    createdAt: isoLocal(2026, 4, 4),   // today — May 4
    grandTotal: 100,
    items: [{ productId: 'p1', productName: 'Widget A', quantity: 5, unitPrice: 10, lineTotal: 50 }],
    subtotal: 83.33, tax: 16.67,
  },
  {
    id: 's2', invoiceNumber: 'INV-222222', customerName: 'Bob',
    createdAt: isoLocal(2026, 4, 2),   // May 2
    grandTotal: 60,
    items: [{ productId: 'p2', productName: 'Gadget B', quantity: 2, unitPrice: 25, lineTotal: 50 }],
    subtotal: 50, tax: 10,
  },
  {
    id: 's3', invoiceNumber: 'INV-333333', customerName: 'Carol',
    createdAt: isoLocal(2026, 3, 30),  // April 30 (previous month)
    grandTotal: 200,
    items: [{ productId: 'p1', productName: 'Widget A', quantity: 10, unitPrice: 10, lineTotal: 100 },
            { productId: 'p4', productName: 'Doohickey', quantity: 5, unitPrice:  8, lineTotal:  40 }],
    subtotal: 166.67, tax: 33.33,
  },
];

// ─────────────────────────────────────────────────────────
describe('calcDashboardStats', () => {
  it('counts low-stock products, this-month sales, and revenue correctly', () => {
    const result = calc.calcDashboardStats(PRODUCTS, SALES, NOW);
    // p2 (qty 5 <= threshold 10) and p3 (qty 0 <= threshold 5) are low-stock
    expect(result.lowStockCount).toBe(2);
    // s1 (May 4) and s2 (May 2) are in May; s3 (Apr 30) is not
    expect(result.monthlySalesCount).toBe(2);
    expect(result.monthlyRevenue).toBeCloseTo(160, 5);
  });

  it('returns zero revenue and zero sales count when no sales this month', () => {
    const sales = [{ createdAt: isoLocal(2026, 3, 30), grandTotal: 500 }]; // April only
    const result = calc.calcDashboardStats(PRODUCTS, sales, NOW);
    expect(result.monthlySalesCount).toBe(0);
    expect(result.monthlyRevenue).toBe(0);
  });

  it('returns zero lowStockCount when all products are well-stocked', () => {
    const products = [{ quantity: 20, lowStockThreshold: 5 }, { quantity: 100, lowStockThreshold: 10 }];
    const result = calc.calcDashboardStats(products, [], NOW);
    expect(result.lowStockCount).toBe(0);
  });

  it('treats missing grandTotal as zero', () => {
    const sales = [
      { createdAt: isoLocal(2026, 4, 1), grandTotal: 50 },
      { createdAt: isoLocal(2026, 4, 2) }, // no grandTotal field
    ];
    const result = calc.calcDashboardStats([], sales, NOW);
    expect(result.monthlyRevenue).toBe(50);
  });

  it('does not mutate input arrays', () => {
    const productsBefore = JSON.stringify(PRODUCTS);
    const salesBefore    = JSON.stringify(SALES);
    calc.calcDashboardStats(PRODUCTS, SALES, NOW);
    expect(JSON.stringify(PRODUCTS)).toBe(productsBefore);
    expect(JSON.stringify(SALES)).toBe(salesBefore);
  });
});

// ─────────────────────────────────────────────────────────
describe('filterLowStock', () => {
  it('returns products at or below threshold, sorted by quantity asc', () => {
    const result = calc.filterLowStock(PRODUCTS);
    // p3 (qty 0) and p2 (qty 5) are low-stock; p3 first
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('p3');
    expect(result[1].id).toBe('p2');
  });

  it('returns empty array when all products are well-stocked', () => {
    const products = [{ quantity: 20, lowStockThreshold: 5 }];
    expect(calc.filterLowStock(products)).toHaveLength(0);
  });

  it('includes products with exactly zero quantity', () => {
    const products = [{ quantity: 0, lowStockThreshold: 0 }]; // qty 0 <= threshold 0
    expect(calc.filterLowStock(products)).toHaveLength(1);
  });

  it('does not mutate input array', () => {
    const before = JSON.stringify(PRODUCTS);
    calc.filterLowStock(PRODUCTS);
    expect(JSON.stringify(PRODUCTS)).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────
describe('bucketRevenueByDay', () => {
  it('returns 7 labels and places each sale into the correct day bucket', () => {
    const result = calc.bucketRevenueByDay(SALES, NOW);
    expect(result.labels).toHaveLength(7);
    expect(result.data).toHaveLength(7);
    // s1 is on May 4 (today, i=0) → last bucket
    expect(result.data[6]).toBe(100);
    // s2 is on May 2 (i=2) → 5th bucket (index 4 from start)
    expect(result.data[4]).toBe(60);
  });

  it('returns all-zero data when sales array is empty', () => {
    const result = calc.bucketRevenueByDay([], NOW);
    expect(result.data.every(v => v === 0)).toBe(true);
  });

  it('sums multiple sales that fall on the same day', () => {
    const sales = [
      { createdAt: isoLocal(2026, 4, 4), grandTotal: 40 },
      { createdAt: isoLocal(2026, 4, 4), grandTotal: 60 },
    ];
    const result = calc.bucketRevenueByDay(sales, NOW);
    expect(result.data[6]).toBe(100); // today bucket
  });

  it('includes a sale on today (day 0 offset)', () => {
    const todaySale = { createdAt: isoLocal(2026, 4, 4), grandTotal: 77 };
    const result = calc.bucketRevenueByDay([todaySale], NOW);
    expect(result.data[6]).toBe(77);
  });

  it('excludes a sale that is older than 7 days', () => {
    // NOW is May 4; oldest bucket is Apr 28 (6 days ago). Apr 27 must be excluded.
    const oldSale = { createdAt: isoLocal(2026, 3, 27), grandTotal: 999 };
    const result = calc.bucketRevenueByDay([oldSale], NOW);
    expect(result.data.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
describe('rankProductsByStock', () => {
  it('returns top-N products sorted by quantity descending', () => {
    const result = calc.rankProductsByStock(PRODUCTS, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('p1'); // qty 50
    expect(result[1].id).toBe('p4'); // qty 30
  });

  it('returns all products when count is less than the limit', () => {
    const result = calc.rankProductsByStock(PRODUCTS, 100);
    expect(result).toHaveLength(PRODUCTS.length);
  });

  it('uses 7 as the default limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: String(i), quantity: i, lowStockThreshold: 0 }));
    expect(calc.rankProductsByStock(many).length).toBe(7);
  });

  it('does not mutate the input array', () => {
    const before = JSON.stringify(PRODUCTS);
    calc.rankProductsByStock(PRODUCTS, 3);
    expect(JSON.stringify(PRODUCTS)).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────
describe('filterProducts', () => {
  it('returns all products when all filters are empty', () => {
    expect(calc.filterProducts(PRODUCTS, '', '', '')).toHaveLength(PRODUCTS.length);
  });

  it('filters by search term matching product name (case-insensitive)', () => {
    const result = calc.filterProducts(PRODUCTS, 'widget', '', '');
    expect(result).toHaveLength(2);
    expect(result.every(p => p.name.toLowerCase().includes('widget'))).toBe(true);
  });

  it('filters by search term matching category', () => {
    const result = calc.filterProducts(PRODUCTS, 'gadget', '', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('filters by exact category match', () => {
    const result = calc.filterProducts(PRODUCTS, '', 'Widgets', '');
    expect(result).toHaveLength(2);
    expect(result.every(p => p.category === 'Widgets')).toBe(true);
  });

  it('filters by status "out" (quantity === 0)', () => {
    const result = calc.filterProducts(PRODUCTS, '', '', 'out');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p3');
  });

  it('filters by status "low" (0 < qty <= threshold)', () => {
    const result = calc.filterProducts(PRODUCTS, '', '', 'low');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2'); // qty 5, threshold 10
  });

  it('filters by status "ok" (qty > threshold)', () => {
    const result = calc.filterProducts(PRODUCTS, '', '', 'ok');
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id).sort()).toEqual(['p1', 'p4']);
  });

  it('applies search, category, and status simultaneously', () => {
    // 'widget' in name AND category 'Widgets' AND status 'ok' → only p1 (qty 50 > 10)
    const result = calc.filterProducts(PRODUCTS, 'widget', 'Widgets', 'ok');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('returns empty array when no products match', () => {
    expect(calc.filterProducts(PRODUCTS, 'nonexistent', '', '')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
describe('stockLevel', () => {
  it('returns "lo" when quantity is zero', () => {
    expect(calc.stockLevel({ quantity: 0, lowStockThreshold: 5 })).toBe('lo');
  });

  it('returns "mid" when quantity equals the threshold (boundary)', () => {
    expect(calc.stockLevel({ quantity: 5, lowStockThreshold: 5 })).toBe('mid');
  });

  it('returns "mid" when quantity is below threshold but above zero', () => {
    expect(calc.stockLevel({ quantity: 3, lowStockThreshold: 10 })).toBe('mid');
  });

  it('returns "hi" when quantity is above threshold', () => {
    expect(calc.stockLevel({ quantity: 11, lowStockThreshold: 10 })).toBe('hi');
  });
});

// ─────────────────────────────────────────────────────────
describe('stockBarPct', () => {
  it('returns 0 for an out-of-stock product', () => {
    expect(calc.stockBarPct({ quantity: 0, lowStockThreshold: 10 })).toBe(0);
  });

  it('returns 100 when quantity equals 3× the threshold', () => {
    // max = max(30, 30, 1) = 30; pct = min(100, 30/30 * 100) = 100
    expect(calc.stockBarPct({ quantity: 30, lowStockThreshold: 10 })).toBe(100);
  });

  it('returns a value between 0 and 100 for partial stock', () => {
    const pct = calc.stockBarPct({ quantity: 5, lowStockThreshold: 10 });
    // max = max(5, 30, 1) = 30; pct = 5/30 * 100 ≈ 16.67
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
    expect(pct).toBeCloseTo(16.67, 1);
  });

  it('never exceeds 100 even for very high stock', () => {
    expect(calc.stockBarPct({ quantity: 10000, lowStockThreshold: 1 })).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────
describe('lineTotal', () => {
  it('multiplies qty by unitPrice', () => {
    expect(calc.lineTotal(3, 9.99)).toBeCloseTo(29.97, 5);
  });

  it('returns 0 when qty is 0', () => {
    expect(calc.lineTotal(0, 25)).toBe(0);
  });

  it('returns 0 when unitPrice is 0', () => {
    expect(calc.lineTotal(10, 0)).toBe(0);
  });

  it('handles decimal prices correctly', () => {
    expect(calc.lineTotal(7, 14.99)).toBeCloseTo(104.93, 5);
  });
});

// ─────────────────────────────────────────────────────────
describe('calcSaleTotals', () => {
  it('calculates 20% tax and grand total from a subtotal', () => {
    const result = calc.calcSaleTotals(100);
    expect(result.subtotal).toBe(100);
    expect(result.tax).toBeCloseTo(20, 5);
    expect(result.grandTotal).toBeCloseTo(120, 5);
  });

  it('returns all zeros for a zero subtotal', () => {
    const result = calc.calcSaleTotals(0);
    expect(result.subtotal).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  it('grandTotal always equals subtotal + tax', () => {
    const sub    = 83.37;
    const result = calc.calcSaleTotals(sub);
    expect(result.grandTotal).toBeCloseTo(result.subtotal + result.tax, 10);
  });

  it('passes the subtotal value through unchanged', () => {
    const result = calc.calcSaleTotals(49.95);
    expect(result.subtotal).toBe(49.95);
  });
});

// ─────────────────────────────────────────────────────────
describe('formatInvoiceNumber', () => {
  it('prefixes the number with "INV-"', () => {
    expect(calc.formatInvoiceNumber(123456)).toBe('INV-123456');
  });

  it('preserves the exact numeric value in the string', () => {
    expect(calc.formatInvoiceNumber(900000)).toBe('INV-900000');
  });
});

// ─────────────────────────────────────────────────────────
describe('validateStockAvailability', () => {
  const products = [
    { id: 'p1', name: 'Widget A', quantity: 10 },
    { id: 'p2', name: 'Gadget B', quantity:  3 },
  ];

  it('returns valid:true when all requested quantities are available', () => {
    const items = [{ productId: 'p1', quantity: 5 }, { productId: 'p2', quantity: 2 }];
    expect(calc.validateStockAvailability(items, products)).toEqual({ valid: true, error: null });
  });

  it('returns valid:true when requested quantity exactly equals available stock', () => {
    const items = [{ productId: 'p1', quantity: 10 }]; // exactly at the limit
    expect(calc.validateStockAvailability(items, products)).toEqual({ valid: true, error: null });
  });

  it('returns valid:false with a descriptive error when quantity exceeds stock', () => {
    const items = [{ productId: 'p2', quantity: 5 }]; // only 3 available
    const result = calc.validateStockAvailability(items, products);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Gadget B');
    expect(result.error).toContain('3');
  });

  it('returns valid:false when productId is not found in products', () => {
    const items = [{ productId: 'DOES_NOT_EXIST', quantity: 1 }];
    const result = calc.validateStockAvailability(items, products);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Product not found.');
  });

  it('returns valid:true for an empty items array', () => {
    expect(calc.validateStockAvailability([], products)).toEqual({ valid: true, error: null });
  });

  it('does not mutate items or products', () => {
    const items    = [{ productId: 'p1', quantity: 2 }];
    const itemsBefore    = JSON.stringify(items);
    const productsBefore = JSON.stringify(products);
    calc.validateStockAvailability(items, products);
    expect(JSON.stringify(items)).toBe(itemsBefore);
    expect(JSON.stringify(products)).toBe(productsBefore);
  });
});

// ─────────────────────────────────────────────────────────
describe('filterSales', () => {
  it('returns all sales when search and date are both empty', () => {
    expect(calc.filterSales(SALES, '', '')).toHaveLength(SALES.length);
  });

  it('filters by customer name (case-insensitive)', () => {
    const result = calc.filterSales(SALES, 'alice', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('filters by invoice number', () => {
    const result = calc.filterSales(SALES, 'INV-222', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s2');
  });

  it('filters by exact date (YYYY-MM-DD, UTC-based)', () => {
    // s3 is on Apr 30 2026 at noon local; derive the UTC date string it produces
    const s3UtcDate = new Date(isoLocal(2026, 3, 30)).toISOString().split('T')[0];
    const result    = calc.filterSales(SALES, '', s3UtcDate);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s3');
  });

  it('returns empty array when nothing matches', () => {
    expect(calc.filterSales(SALES, 'ZZZNOMATCH', '')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
describe('calcReportStats', () => {
  it('computes revenue, count, average, and units sold correctly', () => {
    const result = calc.calcReportStats(SALES);
    // grandTotals: 100 + 60 + 200 = 360
    expect(result.revenue).toBeCloseTo(360, 5);
    expect(result.salesCount).toBe(3);
    expect(result.avgOrderValue).toBeCloseTo(120, 5);
    // units: s1→5, s2→2, s3→10+5 = 22
    expect(result.unitsSold).toBe(22);
  });

  it('returns all zeros for an empty sales array', () => {
    const result = calc.calcReportStats([]);
    expect(result.revenue).toBe(0);
    expect(result.salesCount).toBe(0);
    expect(result.avgOrderValue).toBe(0);
    expect(result.unitsSold).toBe(0);
  });

  it('handles sales with missing grandTotal and missing items gracefully', () => {
    const sales = [{ grandTotal: 100 }, {}]; // second sale has no fields
    const result = calc.calcReportStats(sales);
    expect(result.revenue).toBe(100);
    expect(result.unitsSold).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
describe('bucketRevenueForPeriod', () => {
  it('creates 7 daily buckets and places a sale in the correct bucket', () => {
    const sale   = { createdAt: isoLocal(2026, 4, 2), grandTotal: 75 }; // May 2
    const result = calc.bucketRevenueForPeriod([sale], 7, NOW);
    expect(result.labels).toHaveLength(7);
    const may2Key = new Date(2026, 4, 2).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const idx = result.labels.indexOf(may2Key);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(result.data[idx]).toBe(75);
    expect(result.subtitle).toBe('Daily revenue — last 7 days');
  });

  it('creates 30 daily buckets with the correct subtitle', () => {
    const result = calc.bucketRevenueForPeriod([], 30, NOW);
    expect(result.labels).toHaveLength(30);
    expect(result.subtitle).toBe('Daily revenue — last 30 days');
  });

  it('creates 12 monthly buckets for the 365-day period', () => {
    const result = calc.bucketRevenueForPeriod([], 365, NOW);
    expect(result.labels).toHaveLength(12);
    expect(result.subtitle).toBe('Monthly revenue — last 12 months');
  });

  it('buckets sales spanning a year boundary into separate months', () => {
    // now = Feb 15 2026; buckets cover Mar 2025 – Feb 2026
    const now2    = new Date(2026, 1, 15);
    const decSale = { createdAt: isoLocal(2025, 11, 25), grandTotal: 150 }; // Dec 2025
    const janSale = { createdAt: isoLocal(2026,  0, 10), grandTotal: 200 }; // Jan 2026

    const result  = calc.bucketRevenueForPeriod([decSale, janSale], 365, now2);
    const decKey  = new Date(2025, 11, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    const janKey  = new Date(2026,  0, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    const decIdx  = result.labels.indexOf(decKey);
    const janIdx  = result.labels.indexOf(janKey);

    expect(decIdx).toBeGreaterThanOrEqual(0);
    expect(janIdx).toBeGreaterThanOrEqual(0);
    expect(decIdx).not.toBe(janIdx);           // separate buckets
    expect(result.data[decIdx]).toBe(150);
    expect(result.data[janIdx]).toBe(200);
  });

  it('excludes a sale that falls outside all buckets', () => {
    // For a 7-day window from May 4, a sale on Apr 27 must not appear
    const oldSale = { createdAt: isoLocal(2026, 3, 27), grandTotal: 500 };
    const result  = calc.bucketRevenueForPeriod([oldSale], 7, NOW);
    expect(result.data.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
describe('rankProductsByRevenue', () => {
  it('aggregates lineTotal by product name and returns sorted pairs', () => {
    const result = calc.rankProductsByRevenue(SALES, 10);
    // Widget A: s1 lineTotal 50 + s3 lineTotal 100 = 150
    // Gadget B: s2 lineTotal 50
    // Doohickey: s3 lineTotal 40
    expect(result[0]).toEqual(['Widget A', 150]);
    expect(result[1]).toEqual(['Gadget B',  50]);
    expect(result[2]).toEqual(['Doohickey', 40]);
  });

  it('returns empty array for empty sales', () => {
    expect(calc.rankProductsByRevenue([], 8)).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const result = calc.rankProductsByRevenue(SALES, 1);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Widget A');
  });

  it('uses 8 as the default limit', () => {
    // Build 10 distinct products each in their own sale
    const sales = Array.from({ length: 10 }, (_, i) => ({
      items: [{ productName: `Product ${i}`, lineTotal: (10 - i) * 10 }],
    }));
    expect(calc.rankProductsByRevenue(sales).length).toBe(8);
  });

  it('does not mutate input sales', () => {
    const before = JSON.stringify(SALES);
    calc.rankProductsByRevenue(SALES, 3);
    expect(JSON.stringify(SALES)).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────
describe('aggregateCategoryRevenue', () => {
  it('groups revenue by category using the prodCat lookup', () => {
    // prodCat: p1→Widgets, p2→Gadgets, p4→Misc
    const prodCat = { p1: 'Widgets', p2: 'Gadgets', p4: 'Misc' };
    const result  = calc.aggregateCategoryRevenue(SALES, prodCat);

    const catMap = Object.fromEntries(result);
    // Widgets: s1(50) + s3(100) = 150
    expect(catMap['Widgets']).toBe(150);
    // Gadgets: s2(50) = 50
    expect(catMap['Gadgets']).toBe(50);
    // Misc: s3(40) = 40
    expect(catMap['Misc']).toBe(40);
  });

  it('groups items with unknown productId under "Uncategorised"', () => {
    const sales   = [{ items: [{ productId: 'unknown', lineTotal: 99 }] }];
    const result  = calc.aggregateCategoryRevenue(sales, {});
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Uncategorised');
    expect(result[0][1]).toBe(99);
  });

  it('returns empty array for empty sales', () => {
    expect(calc.aggregateCategoryRevenue([], {})).toHaveLength(0);
  });

  it('returns results sorted by revenue descending', () => {
    const prodCat = { p1: 'Widgets', p2: 'Gadgets', p4: 'Misc' };
    const result  = calc.aggregateCategoryRevenue(SALES, prodCat);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1][1]).toBeGreaterThanOrEqual(result[i][1]);
    }
  });
});

// ─────────────────────────────────────────────────────────
describe('prepareBestSellingItems', () => {
  it('aggregates units and revenue per product name, sorted by revenue desc', () => {
    const result = calc.prepareBestSellingItems(SALES, 10);
    // Widget A: units 5+10=15, revenue 50+100=150
    const widgetA = result.find(([name]) => name === 'Widget A');
    expect(widgetA).toBeDefined();
    expect(widgetA[1].units).toBe(15);
    expect(widgetA[1].revenue).toBe(150);
    // First entry should be Widget A (highest revenue)
    expect(result[0][0]).toBe('Widget A');
  });

  it('returns empty array for empty sales', () => {
    expect(calc.prepareBestSellingItems([], 10)).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const result = calc.prepareBestSellingItems(SALES, 1);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Widget A');
  });

  it('handles items with missing quantity or lineTotal gracefully', () => {
    const sales = [{ items: [{ productName: 'X' }] }]; // no quantity, no lineTotal
    const result = calc.prepareBestSellingItems(sales, 10);
    expect(result[0][1].units).toBe(0);
    expect(result[0][1].revenue).toBe(0);
  });

  it('does not mutate input sales', () => {
    const before = JSON.stringify(SALES);
    calc.prepareBestSellingItems(SALES, 5);
    expect(JSON.stringify(SALES)).toBe(before);
  });
});

// ── Smart / predictive analytics ──────────────────────────
// A dedicated fixture set with denser, more recent sales so the
// velocity / forecast maths has something meaningful to chew on.
// NOW stays May 4 2026.

const VEL_PRODUCTS = [
  { id: 'v1', name: 'Fast Mover',  category: 'A', price: 10, quantity: 12, lowStockThreshold: 10 },
  { id: 'v2', name: 'Slow Mover',  category: 'A', price: 20, quantity: 80, lowStockThreshold: 10 },
  { id: 'v3', name: 'Out Of Stock',category: 'B', price: 15, quantity:  0, lowStockThreshold:  5 },
  { id: 'v4', name: 'Dead Weight', category: 'B', price:  8, quantity: 40, lowStockThreshold:  5 },
];

// Fast Mover sells 30 units over the last 30 days (1/day).
// Slow Mover sells 30 units too but it has deep stock.
// Out Of Stock had recent sales but is now at zero.
// Dead Weight has no sales at all in the window.
const VEL_SALES = [
  { id: 'a', createdAt: isoLocal(2026, 4, 4), grandTotal: 300,
    items: [{ productId: 'v1', productName: 'Fast Mover', quantity: 30, unitPrice: 10, lineTotal: 300 }] },
  { id: 'b', createdAt: isoLocal(2026, 4, 3), grandTotal: 600,
    items: [{ productId: 'v2', productName: 'Slow Mover', quantity: 30, unitPrice: 20, lineTotal: 600 }] },
  { id: 'c', createdAt: isoLocal(2026, 4, 2), grandTotal: 150,
    items: [{ productId: 'v3', productName: 'Out Of Stock', quantity: 10, unitPrice: 15, lineTotal: 150 }] },
  // An old sale outside the 30-day window — must be ignored by velocity.
  { id: 'd', createdAt: isoLocal(2026, 0, 1), grandTotal: 800,
    items: [{ productId: 'v1', productName: 'Fast Mover', quantity: 100, unitPrice: 10, lineTotal: 1000 }] },
];

// ─────────────────────────────────────────────────────────
describe('calcSalesVelocity', () => {
  it('averages units sold per day over the window', () => {
    // 30 units in the last 30 days = 1.0 per day
    expect(calc.calcSalesVelocity(VEL_SALES, 'v1', 30, NOW)).toBeCloseTo(1, 5);
  });

  it('ignores sales older than the window', () => {
    // The 100-unit Jan sale is excluded; only the 30 recent units count
    const vel = calc.calcSalesVelocity(VEL_SALES, 'v1', 30, NOW);
    expect(vel).toBeLessThan(2);
  });

  it('returns 0 for a product with no sales', () => {
    expect(calc.calcSalesVelocity(VEL_SALES, 'v4', 30, NOW)).toBe(0);
  });

  it('returns 0 for a non-positive window', () => {
    expect(calc.calcSalesVelocity(VEL_SALES, 'v1', 0, NOW)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
describe('daysUntilStockout', () => {
  it('divides quantity by velocity', () => {
    expect(calc.daysUntilStockout(12, 1)).toBe(12);
    expect(calc.daysUntilStockout(10, 4)).toBe(2.5);
  });

  it('returns null when velocity is zero', () => {
    expect(calc.daysUntilStockout(50, 0)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
describe('calcReorderSuggestions', () => {
  it('flags a fast mover that runs out within the lead time', () => {
    // Fast Mover: qty 12, velocity 1/day → 12 days cover. With lead time 14 it qualifies.
    const out = calc.calcReorderSuggestions(VEL_PRODUCTS, VEL_SALES, { now: NOW, leadTimeDays: 14 });
    const fm  = out.find(s => s.id === 'v1');
    expect(fm).toBeDefined();
    expect(fm.daysUntilStockout).toBeCloseTo(12, 1);
    expect(fm.suggestedQty).toBeGreaterThan(0);
  });

  it('does not flag a well-stocked slow mover', () => {
    const out = calc.calcReorderSuggestions(VEL_PRODUCTS, VEL_SALES, { now: NOW, leadTimeDays: 7 });
    expect(out.find(s => s.id === 'v2')).toBeUndefined();
  });

  it('marks an out-of-stock product as critical', () => {
    const out = calc.calcReorderSuggestions(VEL_PRODUCTS, VEL_SALES, { now: NOW });
    const oos = out.find(s => s.id === 'v3');
    expect(oos).toBeDefined();
    expect(oos.urgency).toBe('critical');
    expect(oos.quantity).toBe(0);
  });

  it('reports null stockout for an out-of-stock product with no recent sales', () => {
    const products = [{ id: 'z1', name: 'Zero', quantity: 0, lowStockThreshold: 5 }];
    const out = calc.calcReorderSuggestions(products, [], { now: NOW });
    expect(out[0].daysUntilStockout).toBeNull();
    expect(out[0].urgency).toBe('critical');
  });

  it('sorts critical items ahead of warnings', () => {
    const out = calc.calcReorderSuggestions(VEL_PRODUCTS, VEL_SALES, { now: NOW, leadTimeDays: 14 });
    const firstWarn = out.findIndex(s => s.urgency === 'warning');
    const lastCrit  = out.map(s => s.urgency).lastIndexOf('critical');
    if (firstWarn !== -1 && lastCrit !== -1) expect(lastCrit).toBeLessThan(firstWarn);
  });

  it('suggests at least 1 unit and never negative', () => {
    const out = calc.calcReorderSuggestions(VEL_PRODUCTS, VEL_SALES, { now: NOW, leadTimeDays: 14 });
    out.forEach(s => expect(s.suggestedQty).toBeGreaterThanOrEqual(1));
  });

  it('does not mutate inputs', () => {
    const p = JSON.stringify(VEL_PRODUCTS), s = JSON.stringify(VEL_SALES);
    calc.calcReorderSuggestions(VEL_PRODUCTS, VEL_SALES, { now: NOW });
    expect(JSON.stringify(VEL_PRODUCTS)).toBe(p);
    expect(JSON.stringify(VEL_SALES)).toBe(s);
  });
});

// ─────────────────────────────────────────────────────────
describe('findDeadStock', () => {
  it('returns in-stock products with no sales in the window', () => {
    const dead = calc.findDeadStock(VEL_PRODUCTS, VEL_SALES, NOW, 30);
    expect(dead.map(p => p.id)).toContain('v4'); // Dead Weight
  });

  it('excludes out-of-stock products even if they have not sold', () => {
    const dead = calc.findDeadStock(VEL_PRODUCTS, VEL_SALES, NOW, 30);
    expect(dead.map(p => p.id)).not.toContain('v3'); // qty 0, not dead stock
  });

  it('excludes products that have sold within the window', () => {
    const dead = calc.findDeadStock(VEL_PRODUCTS, VEL_SALES, NOW, 30);
    expect(dead.map(p => p.id)).not.toContain('v1');
  });
});

// ─────────────────────────────────────────────────────────
describe('calcAbcAnalysis', () => {
  it('ranks products by revenue and assigns A/B/C classes', () => {
    const rows = calc.calcAbcAnalysis(SALES, PRODUCTS);
    // Widget A has the most revenue (150) → first, class A
    expect(rows[0].name).toBe('Widget A');
    expect(rows[0].class).toBe('A');
    rows.forEach(r => expect(['A', 'B', 'C']).toContain(r.class));
  });

  it('shares sum to ~1 across all products', () => {
    const rows  = calc.calcAbcAnalysis(SALES, PRODUCTS);
    const total = rows.reduce((s, r) => s + r.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('cumulative share is monotonically increasing and ends at ~1', () => {
    const rows = calc.calcAbcAnalysis(SALES, PRODUCTS);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].cumulativeShare).toBeGreaterThanOrEqual(rows[i - 1].cumulativeShare);
    }
    expect(rows[rows.length - 1].cumulativeShare).toBeCloseTo(1, 5);
  });

  it('returns empty array for empty sales', () => {
    expect(calc.calcAbcAnalysis([], PRODUCTS)).toHaveLength(0);
  });

  it('falls back to the item productName when the product is gone', () => {
    const sales = [{ items: [{ productId: 'ghost', productName: 'Ghost Item', quantity: 1, lineTotal: 5 }] }];
    const rows  = calc.calcAbcAnalysis(sales, []);
    expect(rows[0].name).toBe('Ghost Item');
  });
});

// ─────────────────────────────────────────────────────────
describe('generateInsights', () => {
  it('produces an array of well-formed insight cards', () => {
    const out = calc.generateInsights(VEL_PRODUCTS, VEL_SALES, { now: NOW });
    expect(Array.isArray(out)).toBe(true);
    out.forEach(i => {
      expect(i).toHaveProperty('severity');
      expect(i).toHaveProperty('title');
      expect(i).toHaveProperty('text');
      expect(['good', 'warning', 'critical', 'info']).toContain(i.severity);
    });
  });

  it('warns about an out-of-stock product', () => {
    const out = calc.generateInsights(VEL_PRODUCTS, VEL_SALES, { now: NOW });
    expect(out.some(i => i.type === 'oos' && i.severity === 'critical')).toBe(true);
  });

  it('flags dead stock that has not sold', () => {
    const out = calc.generateInsights(VEL_PRODUCTS, VEL_SALES, { now: NOW, deadDays: 30 });
    expect(out.some(i => i.type === 'deadstock')).toBe(true);
  });

  it('reports a week-over-week revenue trend when there is history', () => {
    // Sales this week (within 7 days of NOW) but none the prior week → "picking up"
    const out = calc.generateInsights(VEL_PRODUCTS, VEL_SALES, { now: NOW });
    expect(out.some(i => i.type === 'revenue')).toBe(true);
  });

  it('returns an empty array when there is no data at all', () => {
    expect(calc.generateInsights([], [], { now: NOW })).toHaveLength(0);
  });
});
