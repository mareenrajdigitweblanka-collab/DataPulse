import { chromium, type Browser, type BrowserContext } from "playwright";

import { env } from "../env.js";

export type AmazonProduct = {
  title: string;
  price: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  isPrime: boolean;
  isAvailable: boolean;
  productUrl: string | null;
  imageUrl: string | null;
  ASIN: string;
  isSponsored: boolean;
};

export class AmazonBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmazonBlockedError";
  }
}

function randomDelay(minMs = 1500, maxMs = 4500) {
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

async function launchAmazonBrowser() {
  const browser = await chromium.launch({
    headless: env.AMAZON_HEADLESS,

    /**
     * Proxy is optional for local testing.
     * For serious Amazon scraping, proxy is usually required.
     */
    proxy: getProxyConfig(),

    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  return browser;
}

async function createAmazonContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: {
      width: 1366,
      height: 768,
    },
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.9",
    },
  });
}

async function detectAmazonBlock(context: BrowserContext) {
  const page = context.pages()[0];

  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");

  const captchaInputCount = await page.locator("#captchacharacters").count();

  if (
    captchaInputCount > 0 ||
    title.toLowerCase().includes("robot check") ||
    bodyText.toLowerCase().includes("enter the characters you see below") ||
    bodyText.toLowerCase().includes("sorry, we just need to make sure you're not a robot")
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

          const isSponsored =
            text.includes("sponsored") ||
            element.querySelector("[aria-label='Sponsored']") !== null;

          const isPrime =
            text.includes("prime") ||
            element.querySelector("i[aria-label*='Prime']") !== null ||
            element.querySelector("[aria-label*='Prime']") !== null;

          const isAvailable = !text.includes("currently unavailable");

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
            isSponsored,
            isPrime,
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
      isPrime: item.isPrime,
      isAvailable: item.isAvailable,
      productUrl: normalizeAmazonUrl(item.productUrl),
      imageUrl: item.imageUrl,
      ASIN: item.ASIN,
      isSponsored: item.isSponsored,
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

  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => null),
    nextLocator.click(),
  ]);

  return true;
}

export async function scrapeAmazonSearch(input: {
  query: string;
}) {
  const browser = await launchAmazonBrowser();

  try {
    const context = await createAmazonContext(browser);
    const page = await context.newPage();

    const searchUrl = new URL("/s", env.AMAZON_BASE_URL);
    searchUrl.searchParams.set("k", input.query);

    console.log({
      event: "amazon_navigate_search",
      url: searchUrl.toString(),
    });

    await page.goto(searchUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await detectAmazonBlock(context);

    const collected: AmazonProduct[] = [];
    const seenAsins = new Set<string>();

    for (let pageNumber = 1; pageNumber <= env.AMAZON_MAX_PAGES; pageNumber += 1) {
      await page.waitForSelector('[data-component-type="s-search-result"]', {
        timeout: 30000,
      });

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

    await context.close();

    return collected;
  } finally {
    await browser.close();
  }
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
  if (text.includes("$")) return "USD";
  if (text.includes("€")) return "EUR";
  if (text.includes("A$")) return "AUD";
  if (text.includes("C$")) return "CAD";

  return fallback;
}