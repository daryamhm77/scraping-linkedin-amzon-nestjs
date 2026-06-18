# 🛒 Scraping API — Amazon & LinkedIn Jobs

A NestJS REST API that scrapes Amazon product listings via **Puppeteer + Bright Data Scraping Browser**, and fetches LinkedIn job listings via the **Bright Data Dataset API**.

---

## Table of Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
  - [Amazon](#amazon)
  - [LinkedIn](#linkedin)
- [How Bright Data Works](#how-bright-data-works)
- [Project Structure](#project-structure)

---

## Requirements

- Node.js 18+
- A [Bright Data](https://brightdata.com) account with:
  - A **Scraping Browser** zone (for Amazon / Puppeteer)
  - A **Dataset API token** (for LinkedIn)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
```

Edit `.env` with your Bright Data credentials (see [Environment Variables](#environment-variables) below).

---

## Environment Variables

| Variable | Description |
|---|---|
| `SBR_WS_ENDPOINT` | Bright Data Scraping Browser WebSocket URL (used by Puppeteer) |
| `BRIGHT_DATA_TOKEN` | Bright Data API Bearer token (used by the LinkedIn Dataset API) |
| `PORT` | Port the app listens on (default `3000`) |
| `NODE_ENV` | `development` or `production` |

### Where to find each value

**`SBR_WS_ENDPOINT`**
1. Go to [brightdata.com/cp](https://brightdata.com/cp)
2. Navigate to **Proxies & Scraping Infrastructure → Scraping Browser**
3. Create or open a zone → **Access parameters**
4. Copy the WebSocket URL — it looks like:
   ```
   wss://brd-customer-XXXX-zone-YYYY:PASSWORD@brd.superproxy.io:9222
   ```

**`BRIGHT_DATA_TOKEN`**
1. Go to [brightdata.com/cp](https://brightdata.com/cp)
2. Click your avatar (top-right) → **API Token**
   — or open any scraper → **Code examples** → copy the Bearer token

---

## Running the App

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`.

---

## API Reference

### Amazon

#### `GET /amazon/products`

Search Amazon for products by keyword. Scrapes result cards with title, price, rating, review count, image, and Prime badge.

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `keyword` | string | ✅ | Search term (e.g. `laptop`) |
| `maxPages` | number | ❌ | Number of result pages to scrape (default `1`, max `10`) |
| `minPrice` | number | ❌ | Minimum price filter |
| `maxPrice` | number | ❌ | Maximum price filter |

**Example**
```
GET /amazon/products?keyword=mechanical+keyboard&maxPages=2&maxPrice=150
```

**Response**
```json
{
  "keyword": "mechanical keyboard",
  "count": 48,
  "products": [
    {
      "url": "https://www.amazon.com/dp/...",
      "title": "Keychron K2 Wireless Mechanical Keyboard",
      "price": "$89.99",
      "rating": "4.6 out of 5 stars",
      "reviewCount": "12,453",
      "imageUrl": "https://m.media-amazon.com/images/...",
      "isPrime": true
    }
  ]
}
```

---

#### `GET /amazon/products/details`

Scrape a single Amazon product detail page.

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `url` | string | ✅ | Full Amazon product URL |

**Example**
```
GET /amazon/products/details?url=https://www.amazon.com/dp/B08N5WRWNW
```

**Response**
```json
{
  "title": "Keychron K2 Wireless Mechanical Keyboard",
  "price": "$89.99",
  "rating": "4.6 out of 5 stars",
  "reviewCount": "12,453 ratings",
  "availability": "In Stock",
  "brand": "Visit the Keychron Store",
  "description": "...",
  "imageUrl": "https://m.media-amazon.com/images/...",
  "features": [
    "Bluetooth 5.1 / USB-C wired",
    "Hot-swappable Gateron switches",
    "..."
  ]
}
```

---

### LinkedIn

#### `POST /linkedin/jobs/search`

Synchronous job search — results returned immediately. Best for 1–5 queries.

**Request body**
```json
{
  "queries": [
    {
      "location": "Berlin",
      "keyword": "product manager",
      "country": "DE",
      "time_range": "Past month",
      "job_type": "Full-time",
      "experience_level": "Mid-Senior level",
      "remote": "Hybrid"
    }
  ]
}
```

**Field reference**

| Field | Type | Required | Options |
|---|---|---|---|
| `location` | string | ✅ | City or region (e.g. `"Paris"`) |
| `keyword` | string | ✅ | Job title or skill (e.g. `"python developer"`) |
| `country` | string | ❌ | ISO country code (e.g. `"DE"`, `"US"`) |
| `time_range` | string | ❌ | `Past 24 hours` · `Past week` · `Past month` · `Any time` |
| `job_type` | string | ❌ | `Full-time` · `Part-time` · `Contract` · `Internship` · `Volunteer` |
| `experience_level` | string | ❌ | `Internship` · `Entry level` · `Associate` · `Mid-Senior level` · `Director` · `Executive` |
| `remote` | string | ❌ | `On-site` · `Remote` · `Hybrid` |
| `company` | string | ❌ | Filter by company name |
| `location_radius` | string | ❌ | Radius in km (e.g. `"25"`) |

**Response**
```json
{
  "count": 35,
  "jobs": [
    {
      "title": "Senior Product Manager",
      "company": "Acme GmbH",
      "location": "Berlin, Germany",
      "url": "https://www.linkedin.com/jobs/view/...",
      "posted_date": "2024-01-15",
      "employment_type": "Full-time",
      "seniority_level": "Mid-Senior level"
    }
  ]
}
```

---

#### `POST /linkedin/jobs/search/async`

Asynchronous job search — returns a `snapshot_id` immediately. Use for large or multi-query batches. Optionally provide a webhook URL to be notified when ready.

**Request body**
```json
{
  "queries": [
    { "location": "Paris", "keyword": "product manager", "country": "FR" },
    { "location": "New York", "keyword": "python developer" }
  ],
  "notifyUrl": "https://yourapp.com/webhooks/brightdata"
}
```

**Response** `202 Accepted`
```json
{
  "snapshot_id": "s_abc123xyz",
  "message": "Snapshot queued. Poll GET /linkedin/jobs/snapshot/s_abc123xyz to retrieve results."
}
```

---

#### `GET /linkedin/jobs/snapshot/:snapshotId`

Retrieve results from an async job. By default returns immediately with the current status. Add `?wait=true` to block until the snapshot is ready (up to 5 minutes).

**Example — non-blocking**
```
GET /linkedin/jobs/snapshot/s_abc123xyz
```
```json
{
  "snapshot_id": "s_abc123xyz",
  "status": "pending — retry later or use ?wait=true"
}
```

**Example — blocking**
```
GET /linkedin/jobs/snapshot/s_abc123xyz?wait=true
```
```json
{
  "count": 72,
  "jobs": [ ... ]
}
```

---

## How Bright Data Works

```
Amazon route                         LinkedIn route
─────────────────────────────────    ──────────────────────────────────
Your App → Puppeteer                 Your App → HTTP POST (fetch)
         → SBR WebSocket             → Bright Data Dataset API
         → Bright Data Cloud           (gd_lpfll7v5hcqtkxl6l)
           Browser (anti-bot,         → Bright Data scrapes LinkedIn
           CAPTCHA, rotating IPs)       and returns structured JSON
         → amazon.com
```

The **Scraping Browser** (`SBR_WS_ENDPOINT`) is a remote Chromium instance managed by Bright Data. Puppeteer connects to it over WebSocket instead of launching a local browser. Bright Data handles IP rotation, CAPTCHA solving, and browser fingerprinting so Amazon doesn't block the scraper.

The **Dataset API** (`BRIGHT_DATA_TOKEN`) is a higher-level REST API where you send search parameters and Bright Data returns structured JSON — no browser automation needed on your side.

---

