# StockWise — Smart Inventory Management System

A small web app for running a shop's stock and sales from one place. You add products,
record sales as invoices, and the dashboard shows what's low and what you've taken this
month.

**Live:** https://stockwise-7a8cb.web.app/

Final-year project, BSc Computer Science (Software Engineering), University of Hull.

## What it does

- **Dashboard** — the three numbers worth knowing at a glance: how many items are low,
  how many sales this month, and the month's revenue. Worked out live from your data.
- **Products** — add, edit and delete products. Each one has a price, a quantity, a
  category and its own low-stock threshold.
- **Sales** — record a sale as an invoice with line items and a customer name. The invoice
  number is generated for you and stock comes down as you sell.
- **Reports** — sales history grouped so you can see the trend.
- **Low-stock list** — anything at or below its threshold shows up on its own, most urgent
  first.
- **Accounts** — Firebase Auth sign-in. Your products and sales sit in your own Firestore
  collection, separate from everyone else's.
- **Settings** — account and app preferences.

## Built with

HTML, CSS and plain JavaScript — no framework, no build step. Firebase handles the database
(Firestore) and sign-in (Auth), and it's hosted on Firebase Hosting. Tests run on Vitest.

## How it's put together

The part I'm happiest with is that the maths is kept on its own.

`js/calc.js` is just calculations — dashboard stats, the low-stock filter, invoice totals,
monthly aggregation. It never touches the DOM or Firebase and never mutates its inputs,
which is exactly why it's easy to test. It's exposed as `window.StockWiseCalc` in the
browser and as a normal module in Node.

`js/store.js` is the Firebase side: auth, plus reading and writing each user's products and
sales under `users/{uid}/...`.

Each page is its own HTML file, wired up to those two scripts.

```
.
├── index.html            # sign-in / entry
├── dashboard.html        # the live numbers
├── products.html         # product CRUD
├── sales.html            # invoicing
├── reports.html
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
depending on when or where you run them.

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

Manuel C Madubugini — BSc Computer Science (Software Engineering), University of Hull.
