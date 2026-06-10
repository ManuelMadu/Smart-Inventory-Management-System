# StockWise — Smart Inventory Management System

A small web app for running a shop's stock and sales from one place. You add products,
record sales as invoices, and the dashboard tells you what's low, what's selling, and what
to reorder before you run out.

**Live:** https://stockwise-7a8cb.web.app/

The "smart" part is the point. Most inventory apps just store your numbers and leave the
thinking to you. This one reads your sales history and tells you what's about to run out,
what isn't selling, and where the money's actually coming from.

## What it does

- **Dashboard** — the numbers worth knowing at a glance: items low on stock, sales this
  month, and the month's revenue, all worked out live from your data.
- **Smart insights** — short, plain-English notes at the top of the dashboard, e.g.
  "Revenue is up 23% on last week", "Coffee Beans is running out", "3 items haven't sold in
  a month". No digging through charts to find out what changed.
- **Reorder suggestions** — most apps only warn you once stock is already low. This one
  watches how fast each product sells, works out roughly how many days you have left, and
  tells you how much to order so you can reorder before you run out.
- **Products** — add, edit and delete products. Each has a price, quantity, category and its
  own low-stock threshold.
- **Sales** — record a sale as an invoice with line items and a customer name. The invoice
  number is generated for you and stock comes down as you sell.
- **Reports** — sales trends over time, top products, revenue by category, and an
  **ABC analysis** that sorts your catalogue into the vital few (A), the next tier (B) and
  the long tail (C) by revenue contribution.
- **Accounts** — Firebase Auth sign-in. Your products and sales live in your own Firestore
  collection, separate from everyone else's.
- **Settings** — account and app preferences, including dark mode.

## Built with

HTML, CSS and plain JavaScript. No framework, no build step. Firebase handles the database
(Firestore) and sign-in (Auth), and it's hosted on Firebase Hosting. Tests run on Vitest.

## How it's put together

The part I'm happiest with is that the maths is kept on its own.

`js/calc.js` is just calculations — dashboard stats, the low-stock filter, invoice totals,
monthly aggregation, and all the smart logic: sales velocity, days-until-stockout, reorder
sizing, dead-stock detection, the insight generator and the ABC analysis. It never touches
the DOM or Firebase and never mutates its inputs, which is exactly why it's easy to test.
It's exposed as `window.StockWiseCalc` in the browser and as a normal module in Node.

`js/store.js` is the Firebase side: auth, plus reading and writing each user's products and
sales under `users/{uid}/...`.

Each page is its own HTML file, wired up to those two scripts.

```
.
├── index.html            # sign-in / entry
├── dashboard.html        # live numbers, smart insights, reorder suggestions
├── products.html         # product CRUD
├── sales.html            # invoicing
├── reports.html          # trends + ABC analysis
├── settings.html
├── 404.html
├── css/
├── js/
│   ├── calc.js           # pure logic — all the tests point here
│   └── store.js          # Firebase auth + Firestore
├── tests/
│   └── calc.test.js
├── firebase.json
├── vitest.config.mjs
└── package.json
```

## Tests

Vitest, against fixed product and sales fixtures with a pinned date so results don't drift
depending on when or where you run them. The forecasting and insight functions are covered
the same way. Given the same history, they always produce the same advice.

```bash
npm install
npm test            # run once
npm run test:watch
npm run test:coverage
```

## Running it locally

No build step, so any static server does the job:

```bash
# Firebase CLI — closest to production
npm install -g firebase-tools
firebase serve

# or anything static
npx serve .
```

Then open the URL and sign in.

## Deploying

Firebase Hosting, configured in `firebase.json`. With the CLI set up:

```bash
firebase deploy
```

## A note on the Firebase key

The config in `js/store.js` is public on purpose — that's how Firebase web apps work. The
data is protected by Firestore security rules, not by hiding the key.

## Author

Manuel Madubugini — [github.com/ManuelMadu](https://github.com/ManuelMadu)
