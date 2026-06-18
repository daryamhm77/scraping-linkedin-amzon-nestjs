/**
 * API smoke tests — saves full JSON responses to test-results/
 *
 * Usage:
 *   npm run test:apis              # run all tests
 *   npm run test:apis:amazon       # Amazon only
 *   npm run test:apis:linkedin     # LinkedIn only
 *
 * Env:
 *   BASE_URL=http://localhost:3000   (default)
 *   OUTPUT_DIR=test-results          (default)
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? 'test-results';
const args = new Set(process.argv.slice(2));
const runAmazon = args.size === 0 || args.has('--amazon') || args.has('--all');
const runLinkedIn = args.size === 0 || args.has('--linkedin') || args.has('--all');

const AMAZON_TIMEOUT_MS = 3 * 60 * 1000;
const LINKEDIN_TIMEOUT_MS = 15 * 60 * 1000;

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(OUTPUT_DIR, runId);

/** @type {{ runId: string, baseUrl: string, startedAt: string, finishedAt?: string, passed: number, failed: number, tests: Array<{ name: string, success: boolean, endpoint: string, data?: unknown, error?: string }> }} */
const report = {
  runId,
  baseUrl: BASE_URL,
  startedAt: new Date().toISOString(),
  passed: 0,
  failed: 0,
  tests: [],
};

function log(title, message = '') {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${title}`);
  if (message) console.log(message);
}

function saveJson(filename, data) {
  fs.mkdirSync(runDir, { recursive: true });
  const filePath = path.join(runDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  ↳ saved ${path.relative(process.cwd(), filePath)}`);
  return filePath;
}

function recordTest(name, endpoint, success, data, error) {
  if (success) {
    report.passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    report.failed += 1;
    console.error(`  ✗ ${name}`);
    if (error) console.error(`    ${error}`);
  }

  const entry = { name, success, endpoint };
  if (data !== undefined) entry.data = data;
  if (error) entry.error = error;
  report.tests.push(entry);

  const safeName = name.replace(/[^\w-]+/g, '_').toLowerCase();
  saveJson(`${safeName}.json`, success ? data : { error, response: data });
}

async function request(pathname, options = {}) {
  const url = `${BASE_URL}${pathname}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const msg =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : String(data);
      throw new Error(`HTTP ${response.status}: ${msg}`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkServer() {
  log('Health check', `GET ${BASE_URL}`);
  try {
    await request('/', { timeoutMs: 5_000 });
    console.log('  ✓ Server is reachable');
  } catch {
    console.log('  ✓ Server is reachable (root may 404 — that is fine)');
  }
}

function pickProductUrl(products) {
  const fallback = 'https://www.amazon.com/dp/B0CHHSFMRL';
  if (!Array.isArray(products)) return fallback;

  for (const product of products) {
    if (product?.url?.includes('/dp/')) {
      return product.url;
    }
  }

  return products[0]?.url ?? fallback;
}

async function testAmazonSearch() {
  const endpoint = '/amazon/products?keyword=wireless+mouse&maxPages=1';
  log('Amazon — search products', `GET ${endpoint}`);

  try {
    const data = await request(endpoint, { timeoutMs: AMAZON_TIMEOUT_MS });

    if (!Array.isArray(data.products)) {
      throw new Error('Response missing products array');
    }
    if (data.products.length === 0) {
      throw new Error('No products returned');
    }

    recordTest('amazon-search', endpoint, true, data);
    return pickProductUrl(data.products);
  } catch (error) {
    recordTest(
      'amazon-search',
      endpoint,
      false,
      null,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function testAmazonDetails(productUrl) {
  const url =
    productUrl ?? 'https://www.amazon.com/dp/B0CHHSFMRL';
  const endpoint = `/amazon/products/details?url=${encodeURIComponent(url)}`;
  log('Amazon — product details', `GET ${endpoint}`);

  try {
    const data = await request(endpoint, { timeoutMs: AMAZON_TIMEOUT_MS });

    if (!data?.title) {
      throw new Error('Response missing product title');
    }

    recordTest('amazon-details', endpoint, true, data);
  } catch (error) {
    recordTest(
      'amazon-details',
      endpoint,
      false,
      null,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testLinkedInSearchSync() {
  const endpoint = '/linkedin/jobs/search';
  log('LinkedIn — sync job search', `POST ${endpoint}`);

  const body = {
    queries: [
      {
        location: 'Berlin',
        keyword: 'software engineer',
        country: 'DE',
        remote: 'Hybrid',
      },
    ],
  };

  try {
    const data = await request(endpoint, {
      method: 'POST',
      timeoutMs: LINKEDIN_TIMEOUT_MS,
      body: JSON.stringify(body),
    });

    if (!Array.isArray(data.jobs)) {
      throw new Error('Response missing jobs array');
    }
    if (data.jobs.length === 0) {
      throw new Error('No jobs returned');
    }

    recordTest('linkedin-search-sync', endpoint, true, data);
  } catch (error) {
    recordTest(
      'linkedin-search-sync',
      endpoint,
      false,
      null,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testLinkedInSearchAsync() {
  const endpoint = '/linkedin/jobs/search/async';
  log('LinkedIn — async job search', `POST ${endpoint}`);

  const body = {
    queries: [
      {
        location: 'London',
        keyword: 'product manager',
        country: 'GB',
      },
    ],
  };

  try {
    const queued = await request(endpoint, {
      method: 'POST',
      timeoutMs: 30_000,
      body: JSON.stringify(body),
    });

    if (!queued.snapshot_id) {
      throw new Error('Response missing snapshot_id');
    }

    saveJson('linkedin-async-queued.json', queued);

    const pollEndpoint = `/linkedin/jobs/snapshot/${encodeURIComponent(queued.snapshot_id)}?wait=true`;
    log('LinkedIn — poll snapshot', `GET ${pollEndpoint}`);

    const snapshot = await request(pollEndpoint, {
      timeoutMs: LINKEDIN_TIMEOUT_MS,
    });

    if (!Array.isArray(snapshot.jobs) || snapshot.jobs.length === 0) {
      throw new Error('Async poll returned no jobs');
    }

    recordTest('linkedin-search-async', endpoint, true, {
      queued,
      snapshot,
    });
  } catch (error) {
    recordTest(
      'linkedin-search-async',
      endpoint,
      false,
      null,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function main() {
  console.log('API smoke tests (with JSON output)');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output dir: ${runDir}`);

  await checkServer();

  if (runAmazon) {
    const productUrl = await testAmazonSearch();
    await testAmazonDetails(productUrl);
  }

  if (runLinkedIn) {
    await testLinkedInSearchSync();
    await testLinkedInSearchAsync();
  }

  report.finishedAt = new Date().toISOString();
  saveJson('_summary.json', report);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Results: ${report.passed} passed, ${report.failed} failed`);
  console.log(`Full report: ${path.relative(process.cwd(), path.join(runDir, '_summary.json'))}`);

  if (report.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});
