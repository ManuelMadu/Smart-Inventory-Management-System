# StockWise — Smart Inventory Management System

A lightweight, cloud-hosted inventory and point-of-sale web app that lets a retailer
track stock, record sales, and read back live business metrics from a single dashboard.

**Live demo:** https://stockwise-7a8cb.web.app/

> Final-year (Honours Stage) project — University of Hull, BSc Computer Science (Software Engineering).

---

## Overview

StockWise models the core workflows of a real retail business — products, stock levels,
sales/invoicing and reporting — in a fast, no-build web app. It runs entirely on the
client against a Firebase backend, with every user's data scoped privately to their own
account.

The design goal was a small, honest codebase with a **clean separation between pure
business logic and I/O**, so the parts that matter (stock and revenue calculations) are
fully unit-tested.

## Features

- **Dashboard** — headline stats at a glance: low-stock item count, sales this month, and
  monthly revenue, all computed live from the underlying data.
- **Products** — add, edit and delete products with price, quantity, category and a
  per-product low-stock threshold.
- **Sales** — record sales as line-item invoices with an auto-generated invoice number,
  customer name and grand total; stock is decremented accordingly.
- **Reports** — aggregate views over sales history for revenue and trends.
- **Low-stock alerts** — products at or below their threshold are surfaced automatically,
  sorted most-critical-first.
- **Authentication** — Firebase Auth; each account's products and sales are stored in a
  private, per-user Firestore collection.
- **Settings** — account and app preferences.

## Tech Stack

| Layer        | Technology                                            |
|--------------|-------------------------------------------------------|
| Front-end    | HTML5, CSS3, vanilla JavaScript (no framework, no build step) |
| Backend      | Firebase — Firestore (database) and Firebase Auth     |
| Hosting      | Firebase Hosting                                      |
| Testing      | Vitest (unit tests for the calculation layer)         |
| Tooling      | Git/GitHub, npm                                       |

## Architecture

The codebase deliberately splits **pure logic** from **side effects**:

- **`js/calc.js`** — pure calculation functions (dashboard stats, low-stock filtering,
  invoice totals, monthly aggregation). No DOM access, no Firebase calls, no mutation of
  inputs — the same inputs always produce the same outputs, which makes them trivially
  testable. Exposed as `window.StockWiseCalc` in the browser and `module.exports` in Node.
- **`js/store.js`** — the Firebase data layer (Auth + Firestore). Reads and writes each
  user's products and sales under `users/{uid}/...`.
- **`*.html`** — one page per area (`dashboard`, `products`, `sales`, `reports`,
  `settings`), wired up with the scripts above.

```
.
├── index.html            # entry / sign-in
├── dashboard.html        # live KPIs
├── products.html         # product CRUD
├── sales.html            # invoicing
├── reports.html          # aggregate reporting
├── settings.html         # account / preferences
├── 404.html
├── css/                  # styles
├── js/
│   ├── calc.js           # pure, tested business logic
│   └── store.js          # Firebase Auth + Firestore data layer
├── tests/
│   └── calc.test.js      # Vitest unit tests
├── firebase.json         # Firebase Hosting config
├── vitest.config.mjs
└── package.json
```

## Testing

The calculation layer is covered by unit tests with fixed product/sales fixtures and a
pinned reference date, so results are deterministic across any environment (including CI).

```bash
npm install
npm test            # run the Vitest suite once
npm run test:watch  # watch mode
npm run test:coverage
```

## Running Locally

Because there is no build step, you can serve the folder with any static server:

```bash
# option 1: Firebase CLI (matches production hosting)
npm install -g firebase-tools
firebase serve

# option 2: any static server
npx serve .
```

Then open the served URL in a browser and sign in.

## Deployment

Hosted on Firebase Hosting (config in `firebase.json`). With the Firebase CLI configured:

```bash
firebase deploy
```

## Notes

- The Firebase web config in `js/store.js` is a public client config (this is by design for
  Firebase web apps); access is controlled by Firestore security rules, not by hiding the key.

## Author

**Manuel C Madubugini** — BSc Computer Science (Software Engineering), University of Hull.
