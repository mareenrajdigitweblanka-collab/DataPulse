import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext, Page } from "playwright";

import { env } from "../env.js";

/**
 * Register the stealth plugin once at module load. It patches the obvious
 * automation fingerprints (navigator.webdriver, WebGL vendor, plugins,
 * chrome runtime, permissions) that give away vanilla Playwright — the
 * signals Amazon checks regardless of the request IP.
 */
chromium.use(StealthPlugin());

export type AmazonProduct = {
  title: string;
  price: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  isAvailable: boolean;
  productUrl: string | null;
  imageUrl: string | null;
  ASIN: string;
};

export class AmazonBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmazonBlockedError";
  }
}

function randomDelay(minMs = 2000, maxMs = 6000) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  return new Promise((resolve) => setTimeout(resolve, delay));
}

function parsePrice(text: string | null): number | null {
  if (!text) return null;

  const cleaned = text
    .replace(/\u00a0/g, " ")
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, "");

  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseRating(text: string | null): number | null {
  if (!text) return null;

  const match = text.match(/([0-9.]+)\s*out of/i);
  const parsed = match ? Number.parseFloat(match[1]) : Number.parseFloat(text);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseReviewCount(text: string | null): number | null {
  if (!text) return null;

  const upper = text.trim().toUpperCase();

  const kMatch = upper.match(/([0-9]+(?:\.[0-9]+)?)\s*K(?:[^A-Z0-9]|$)/);
  if (kMatch) {
    const n = Math.round(parseFloat(kMatch[1]) * 1_000);
    return Number.isFinite(n) ? n : null;
  }

  const mMatch = upper.match(/([0-9]+(?:\.[0-9]+)?)\s*M(?:[^A-Z0-9]|$)/);
  if (mMatch) {
    const n = Math.round(parseFloat(mMatch[1]) * 1_000_000);
    return Number.isFinite(n) ? n : null;
  }

  const cleaned = text.replace(/[^0-9]/g, "");
  const parsed = Number.parseInt(cleaned, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAmazonUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    if (url.startsWith("http")) return url;

    return new URL(url, env.AMAZON_BASE_URL).toString();
  } catch {
    return null;
  }
}

function getProxyConfig() {
  if (!env.AMAZON_PROXY_SERVER) return undefined;

  return {
    server: env.AMAZON_PROXY_SERVER,
    username: env.AMAZON_PROXY_USERNAME || undefined,
    password: env.AMAZON_PROXY_PASSWORD || undefined,
  };
}

/**
 * A small pool of realistic, recent Chrome identities. User-agent,
 * client-hint headers (sec-ch-ua*) and viewport must agree with each
 * other and with the locale/timezone from getLocaleForStore(), or the
 * mismatch itself becomes a bot signal. Rotated per retry attempt so a
 * blocked identity is not reused on the next attempt.
 */
type AmazonIdentity = {
  userAgent: string;
  secChUa: string;
  platform: string;
  viewport: { width: number; height: number };
};

const IDENTITY_POOL: AmazonIdentity[] = [
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    platform: '"Windows"',
    viewport: { width: 1366, height: 768 },
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="135", "Google Chrome";v="135", "Not.A/Brand";v="99"',
    platform: '"Windows"',
    viewport: { width: 1536, height: 864 },
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    platform: '"macOS"',
    viewport: { width: 1440, height: 900 },
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not.A/Brand";v="99"',
    platform: '"Windows"',
    viewport: { width: 1920, height: 1080 },
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="135", "Google Chrome";v="135", "Not.A/Brand";v="99"',
    platform: '"macOS"',
    viewport: { width: 1512, height: 982 },
  },
];

function getIdentity(attempt: number): AmazonIdentity {
  return IDENTITY_POOL[attempt % IDENTITY_POOL.length];
}

/**
 * Launch a persistent context so cookies/session accumulate across jobs
 * from the same IP — a returning visitor is trusted more than a cold one.
 * Each identity keeps its own profile dir so per-attempt rotation does not
 * leak a blocked identity's cookies into the next attempt.
 */
async function launchAmazonContext(attempt: number): Promise<BrowserContext> {
  const identity = getIdentity(attempt);
  const { locale, timezoneId, acceptLanguage } = getLocaleForStore();

  const options = {
    headless: env.AMAZON_HEADLESS,

    /**
     * Proxy is optional. Without one, success depends on session trust and
     * a low request rate (see the worker's inter-job cooldown).
     */
    proxy: getProxyConfig(),

    viewport: identity.viewport,
    locale,
    timezoneId,
    userAgent: identity.userAgent,
    extraHTTPHeaders: {
      "accept-language": acceptLanguage,
      "sec-ch-ua": identity.secChUa,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": identity.platform,
    },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-infobars",
      `--window-size=${identity.viewport.width},${identity.viewport.height}`,
      `--lang=${locale}`,
    ],
  };

  const userDataDir = `${env.AMAZON_USER_DATA_DIR}-${attempt % IDENTITY_POOL.length}`;

  /**
   * Prefer real installed Chrome (more trustworthy fingerprint than the
   * bundled Chromium). Fall back to bundled Chromium where Chrome is not
   * installed (e.g. dev machines / CI).
   */
  try {
    return await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      ...options,
    });
  } catch {
    return await chromium.launchPersistentContext(userDataDir, options);
  }
}

async function dismissCookieBanner(page: Page) {
  const acceptSelectors = [
    "#sp-cc-accept",
    "input#sp-cc-accept",
    "[data-cel-widget='sp-cc-accept']",
  ];

  for (const selector of acceptSelectors) {
    const button = page.locator(selector).first();

    if ((await button.count()) > 0) {
      await button.click({ timeout: 3000 }).catch(() => null);
      return;
    }
  }
}

/**
 * Search the human way: focus the search box and type the query with
 * per-keystroke delay, then submit. Produces a natural referer chain and
 * keystroke timing. Returns false if the box is not present so the caller
 * can fall back to direct-URL navigation.
 */
async function searchViaBox(page: Page, query: string): Promise<boolean> {
  const box = page.locator("#twotabsearchtextbox");

  if ((await box.count()) === 0) return false;

  try {
    await box.click({ timeout: 5000 });
    await box.fill("");
    await box.pressSequentially(query, {
      delay: 50 + Math.floor(Math.random() * 100),
    });
    await randomDelay(400, 1200);
    await page.keyboard.press("Enter");

    return true;
  } catch {
    return false;
  }
}

/** Light human signal: a small mouse move and scroll before extraction. */
async function humanScroll(page: Page) {
  await page.mouse
    .move(200 + Math.floor(Math.random() * 800), 200 + Math.floor(Math.random() * 400))
    .catch(() => null);

  await page
    .evaluate(() => {
      window.scrollBy(0, 300 + Math.floor(Math.random() * 1200));
    })
    .catch(() => null);
}

/**
 * Open the search results, optionally warming a session first (homepage +
 * cookie consent + typed search). Falls back to direct-URL navigation.
 */
async function openSearchResults(page: Page, context: BrowserContext, query: string) {
  const searchUrl = new URL("/s", env.AMAZON_BASE_URL);
  searchUrl.searchParams.set("k", query);

  if (env.AMAZON_WARMUP) {
    const homeResponse = await page.goto(env.AMAZON_BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await detectAmazonBlock(context, homeResponse?.status());
    await dismissCookieBanner(page);
    await randomDelay();

    if (await searchViaBox(page, query)) {
      await page
        .waitForLoadState("domcontentloaded", { timeout: 30000 })
        .catch(() => null);
      await detectAmazonBlock(context);
      return;
    }
  }

  console.log({
    event: "amazon_navigate_search",
    url: searchUrl.toString(),
  });

  const response = await page.goto(searchUrl.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await detectAmazonBlock(context, response?.status());
}

async function detectAmazonBlock(context: BrowserContext, status?: number | null) {
  if (status && [403, 429, 503].includes(status)) {
    throw new AmazonBlockedError(`Amazon returned HTTP ${status}`);
  }

  const page = context.pages()[0];

  const url = page.url().toLowerCase();
  const title = (await page.title().catch(() => "")).toLowerCase();
  const bodyText = (
    await page.locator("body").innerText({ timeout: 3000 }).catch(() => "")
  ).toLowerCase();

  const captchaInputCount = await page.locator("#captchacharacters").count();

  if (
    captchaInputCount > 0 ||
    url.includes("/errors/validatecaptcha") ||
    title.includes("robot check") ||
    bodyText.includes("enter the characters you see below") ||
    bodyText.includes("sorry, we just need to make sure you're not a robot") ||
    bodyText.includes("api-services-support@amazon") ||
    bodyText.includes("automated access") ||
    bodyText.includes("to discuss automated access")
  ) {
    throw new AmazonBlockedError("Amazon CAPTCHA or robot check detected");
  }
}

async function extractProductsFromPage(context: BrowserContext) {
  const page = context.pages()[0];

  const rawProducts = await page.$$eval(
    '[data-component-type="s-search-result"][data-asin]',
    (cards) => {
      return cards
        .map((card) => {
          const element = card as HTMLElement;

          const asin = element.getAttribute("data-asin")?.trim() ?? "";

          const title =
            element.querySelector("h2 span")?.textContent?.trim() ??
            element.querySelector(".a-size-medium.a-color-base.a-text-normal")?.textContent?.trim() ??
            element.querySelector(".a-size-base-plus.a-color-base.a-text-normal")?.textContent?.trim() ??
            "";

          const primaryPrice =
            element.querySelector(".a-price .a-offscreen")?.textContent?.trim() ??
            element.querySelector(".a-color-base .a-offscreen")?.textContent?.trim() ??
            null;

          const secondaryOfferPrice =
            element
              .querySelector('[data-cy="secondary-offer-recipe"] .a-color-base')
              ?.textContent?.trim() ??
            null;

          const ariaPrice =
            element.querySelector("[aria-label*='LKR']")?.getAttribute("aria-label") ??
            element.querySelector("[aria-label*='£']")?.getAttribute("aria-label") ??
            element.querySelector("[aria-label*='$']")?.getAttribute("aria-label") ??
            element.querySelector("[aria-label*='€']")?.getAttribute("aria-label") ??
            null;

          const priceWhole =
            element.querySelector(".a-price-whole")?.textContent?.trim() ?? null;

          const priceFraction =
            element.querySelector(".a-price-fraction")?.textContent?.trim() ?? "";

          const price =
            primaryPrice ??
            secondaryOfferPrice ??
            ariaPrice ??
            (priceWhole
              ? priceFraction
                ? `${priceWhole}.${priceFraction}`
                : priceWhole
              : null);

          const rating =
            element.querySelector(".a-icon-alt")?.textContent?.trim() ??
            element.querySelector("[aria-label*='out of']")?.getAttribute("aria-label") ??
            null;

          const reviewText =
            element.querySelector("a[href*='customerReviews'] span")?.textContent?.trim() ??
            element.querySelector(".a-size-base.s-underline-text")?.textContent?.trim() ??
            null;

          const link =
            element.querySelector("a.a-link-normal.s-no-outline")?.getAttribute("href") ??
            element.querySelector("h2 a")?.getAttribute("href") ??
            null;

          const image =
            element.querySelector("img.s-image")?.getAttribute("src") ??
            null;

          const text = element.innerText.toLowerCase();

          const unavailableMessage =
            element.querySelector(".a-color-price")?.textContent?.toLowerCase() ?? "";

          const isAvailable =
            !unavailableMessage.includes("currently unavailable") &&
            !text.includes("currently unavailable");

          return {
            ASIN: asin,
            title,
            price: price && priceFraction && !price.includes(".")
              ? `${price}.${priceFraction}`
              : price,
            rating,
            reviewText,
            productUrl: link,
            imageUrl: image,
            isAvailable,
          };
        })
        .filter((item) => item.ASIN && item.title);
    }
  );

  return rawProducts.map((item): AmazonProduct => {
    return {
      title: item.title,
      price: parsePrice(item.price),
      currency: inferCurrencyFromPriceText(item.price, getAmazonCurrency()),
      rating: parseRating(item.rating),
      reviewCount: parseReviewCount(item.reviewText),
      isAvailable: item.isAvailable,
      productUrl: normalizeAmazonUrl(item.productUrl),
      imageUrl: item.imageUrl,
      ASIN: item.ASIN,
    };
  });
}

async function goToNextPage(context: BrowserContext) {
  const page = context.pages()[0];

  const nextLocator = page.locator("a.s-pagination-next").first();

  if ((await nextLocator.count()) === 0) {
    return false;
  }

  const disabledClass = await nextLocator.getAttribute("class").catch(() => "");

  if (disabledClass?.includes("s-pagination-disabled")) {
    return false;
  }

  await nextLocator.click();
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => null);

  return true;
}

export async function scrapeAmazonSearch(input: {
  query: string;
  attempt?: number;
}) {
  const attempt = input.attempt ?? 0;
  const context = await launchAmazonContext(attempt);

  try {
    const page = context.pages()[0] ?? (await context.newPage());

    await openSearchResults(page, context, input.query);

    const collected: AmazonProduct[] = [];
    const seenAsins = new Set<string>();

    for (let pageNumber = 1; pageNumber <= env.AMAZON_MAX_PAGES; pageNumber += 1) {
      await page.waitForSelector('[data-component-type="s-search-result"]', {
        timeout: 30000,
      });

      await humanScroll(page);
      await randomDelay();

      await detectAmazonBlock(context);

      const pageProducts = await extractProductsFromPage(context);

      let addedFromPage = 0;

      for (const product of pageProducts) {
        if (seenAsins.has(product.ASIN)) continue;

        seenAsins.add(product.ASIN);
        collected.push(product);
        addedFromPage += 1;

        if (collected.length >= env.AMAZON_RESULT_LIMIT) {
          break;
        }
      }

      console.log({
        event: "amazon_page_scraped",
        query: input.query,
        page: pageNumber,
        foundOnPage: pageProducts.length,
        addedFromPage,
        totalCollected: collected.length,
        configuredLimit: env.AMAZON_RESULT_LIMIT,
      });

      if (collected.length >= env.AMAZON_RESULT_LIMIT) {
        break;
      }

      if (pageNumber >= env.AMAZON_MAX_PAGES) {
        break;
      }

      const moved = await goToNextPage(context);

      if (!moved) {
        break;
      }
    }

    return collected;
  } finally {
    await context.close();
  }
}

function getLocaleForStore(): { locale: string; timezoneId: string; acceptLanguage: string } {
  const hostname = new URL(env.AMAZON_BASE_URL).hostname;

  if (hostname.endsWith("amazon.co.uk"))  return { locale: "en-GB", timezoneId: "Europe/London",    acceptLanguage: "en-GB,en;q=0.9" };
  if (hostname.endsWith("amazon.de"))     return { locale: "de-DE", timezoneId: "Europe/Berlin",    acceptLanguage: "de-DE,de;q=0.9,en;q=0.8" };
  if (hostname.endsWith("amazon.fr"))     return { locale: "fr-FR", timezoneId: "Europe/Paris",     acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8" };
  if (hostname.endsWith("amazon.it"))     return { locale: "it-IT", timezoneId: "Europe/Rome",      acceptLanguage: "it-IT,it;q=0.9,en;q=0.8" };
  if (hostname.endsWith("amazon.es"))     return { locale: "es-ES", timezoneId: "Europe/Madrid",    acceptLanguage: "es-ES,es;q=0.9,en;q=0.8" };
  if (hostname.endsWith("amazon.ca"))     return { locale: "en-CA", timezoneId: "America/Toronto",  acceptLanguage: "en-CA,en;q=0.9" };
  if (hostname.endsWith("amazon.com.au")) return { locale: "en-AU", timezoneId: "Australia/Sydney", acceptLanguage: "en-AU,en;q=0.9" };

  return { locale: "en-US", timezoneId: "America/New_York", acceptLanguage: "en-US,en;q=0.9" };
}

function getAmazonCurrency(): string {
  const hostname = new URL(env.AMAZON_BASE_URL).hostname;

  if (hostname.endsWith("amazon.co.uk")) return "GBP";
  if (hostname.endsWith("amazon.de")) return "EUR";
  if (hostname.endsWith("amazon.fr")) return "EUR";
  if (hostname.endsWith("amazon.it")) return "EUR";
  if (hostname.endsWith("amazon.es")) return "EUR";
  if (hostname.endsWith("amazon.ca")) return "CAD";
  if (hostname.endsWith("amazon.com.au")) return "AUD";

  return "USD";
}

function inferCurrencyFromPriceText(text: string | null, fallback: string) {
  if (!text) return fallback;

  if (text.includes("LKR")) return "LKR";
  if (text.includes("£")) return "GBP";
  if (text.includes("A$")) return "AUD";
  if (text.includes("C$")) return "CAD";
  if (text.includes("$")) return "USD";
  if (text.includes("€")) return "EUR";

  return fallback;
}