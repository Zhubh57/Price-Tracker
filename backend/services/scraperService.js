/**
 * scraperService.js
 *
 * Pluggable, multi-site price scraper service.
 * Each supported site is defined as a self-contained "scraper config" object.
 * The service dynamically resolves the correct config based on the product URL
 * and runs Puppeteer with stealth mode to extract product data.
 *
 * Supported sites: Amazon.in, Flipkart
 * Easily extensible to: Myntra, AJIO, etc.
 *
 * Dependencies:
 *   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Apply the stealth plugin to evade bot-detection mechanisms
puppeteer.use(StealthPlugin());

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Returns a random integer between min and max (inclusive).
 * Used to add human-like random delays between browser actions.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Pauses execution for a random duration between 2–5 seconds.
 * Mimics human browsing behaviour and reduces bot-detection risk.
 * @returns {Promise<void>}
 */
const randomDelay = () =>
  new Promise((resolve) => setTimeout(resolve, randomInt(2000, 5000)));

/**
 * Pool of common desktop user-agent strings.
 * A random one is chosen per scrape session to avoid fingerprinting.
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

/** Returns a random user-agent string from the pool. */
const randomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// ---------------------------------------------------------------------------
// Site scraper configurations (the "pluggable" part)
// ---------------------------------------------------------------------------
// Each config object defines:
//   match(url)     – returns true if this config handles the given URL
//   siteName       – human-readable site label stored in the DB
//   scrape(page)   – async fn that extracts { title, price, image } from the
//                    already-navigated Puppeteer page. Throws on failure.
// ---------------------------------------------------------------------------

const SCRAPER_CONFIGS = [
  // -------------------------------------------------------------------------
  // Amazon.in
  // -------------------------------------------------------------------------
  {
    siteName: "Amazon",

    /**
     * Matches Amazon India product URLs.
     * Covers both amazon.in and www.amazon.in hostnames.
     * @param {string} url
     * @returns {boolean}
     */
    match(url) {
      return /amazon\.in/i.test(url);
    },

    /**
     * Extracts product data from an Amazon.in product page.
     * Uses multiple fallback selectors because Amazon's DOM varies by
     * category, device, and A/B test bucket.
     *
     * @param {import('puppeteer').Page} page  Already-navigated Puppeteer page
     * @returns {Promise<{ title: string, price: number, image: string }>}
     */
    async scrape(page) {
      // Wait for the primary product title to appear
      await page.waitForSelector("#productTitle", { timeout: 15000 });

      // Give dynamic content a brief moment to hydrate after title appears
      await new Promise(resolve => setTimeout(resolve, 2000));

      // --- Title ---
      const title = await page.$eval(
        "#productTitle",
        (el) => el.textContent.trim()
      );

      // --- Price (multiple fallback selectors) ---
      const priceSelectors = [
        ".priceToPay .a-price-whole",
        ".a-price-whole",
        ".a-price .a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".apexPriceToPay .a-price-whole",
        "#tp_price_block_total_price_ww .a-price-whole"
      ];

      let rawPrice = null;
      let successfulSelector = null;

      for (const selector of priceSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            rawPrice = await page.$eval(selector, (el) => {
              // Extract text, remove ₹, commas, and whitespace
              const text = el.textContent || el.innerText || "";
              return text.replace(/[₹,]/g, "").trim();
            });
            
            // Validate that we actually got a number
            if (rawPrice && !isNaN(parseFloat(rawPrice))) {
              successfulSelector = selector;
              break;
            }
          }
        } catch {
          // Selector not found on this page variant – try next
        }
      }

      if (!rawPrice || isNaN(parseFloat(rawPrice))) {
        throw new Error("Amazon: Could not locate price using any known selector.");
      }

      console.log(`[ScraperService] Amazon price found using selector: "${successfulSelector}"`);

      // Remove any remaining non-numeric characters and convert to float
      const price = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));

      // --- Image (multiple fallback selectors) ---
      const imageSelectors = [
        "#landingImage",      // Main product image (most listings)
        "#imgBlkFront",       // Book/media front cover
        ".a-dynamic-image",   // Dynamic image block
      ];

      let image = "";
      for (const selector of imageSelectors) {
        try {
          image = await page.$eval(selector, (el) => {
            // Amazon lazy-loads hi-res via data-old-hires or data-a-dynamic-image
            return (
              el.getAttribute("data-old-hires") ||
              el.getAttribute("src") ||
              ""
            );
          });
          if (image) break;
        } catch {
          // Selector not present – try next
        }
      }

      return { title, price, image };
    },
  },

  // -------------------------------------------------------------------------
  // Flipkart
  // -------------------------------------------------------------------------
  {
    siteName: "Flipkart",

    /**
     * Matches Flipkart product URLs.
     * @param {string} url
     * @returns {boolean}
     */
    match(url) {
      return /flipkart\.com/i.test(url);
    },

    /**
     * Extracts product data from a Flipkart product page.
     * Flipkart is a React SPA – we wait for key DOM nodes to hydrate.
     *
     * @param {import('puppeteer').Page} page  Already-navigated Puppeteer page
     * @returns {Promise<{ title: string, price: number, image: string }>}
     */
    async scrape(page) {
      // Wait for the product title (Flipkart uses a <span> with class patterns)
      await page.waitForSelector(".B_NuCI, .yhB1nd", { timeout: 15000 });

      // --- Title ---
      // Primary class .B_NuCI for most products; .yhB1nd for some categories
      const titleSelectors = [".B_NuCI", ".yhB1nd", "h1.product-title"];
      let title = "";
      for (const selector of titleSelectors) {
        try {
          title = await page.$eval(selector, (el) => el.textContent.trim());
          if (title) break;
        } catch {
          // Not found – try next
        }
      }

      // --- Price ---
      // Flipkart wraps the selling price in ._30jeq3 for most categories
      const priceSelectors = [
        "._30jeq3._16Jk6d", // Selling price (most products)
        "._30jeq3",          // Generic price element
        ".CEmiEU ._30jeq3",  // Alternate wrapper
      ];

      let rawPrice = null;
      for (const selector of priceSelectors) {
        try {
          rawPrice = await page.$eval(selector, (el) =>
            el.textContent.replace(/[^0-9.]/g, "").trim()
          );
          if (rawPrice) break;
        } catch {
          // Selector not present – try next
        }
      }

      if (!rawPrice) {
        throw new Error("Flipkart: Could not locate price using any known selector.");
      }

      const price = parseFloat(rawPrice.replace(/,/g, ""));

      // --- Image ---
      const imageSelectors = [
        "._396cs4._2amPTt._3qGmMb", // Primary image (most listings)
        ".CXW8mj img",               // Image container for some categories
        "img._2r_T1I",               // Fashion / apparel images
      ];

      let image = "";
      for (const selector of imageSelectors) {
        try {
          image = await page.$eval(selector, (el) => el.getAttribute("src") || "");
          if (image) break;
        } catch {
          // Selector not present – try next
        }
      }

      return { title, price, image };
    },
  },

  // -------------------------------------------------------------------------
  // Myntra (stub – selectors to be filled in when extending)
  // -------------------------------------------------------------------------
  // {
  //   siteName: "Myntra",
  //   match(url) { return /myntra\.com/i.test(url); },
  //   async scrape(page) {
  //     // TODO: add Myntra selectors here
  //   },
  // },

  // -------------------------------------------------------------------------
  // AJIO (stub – selectors to be filled in when extending)
  // -------------------------------------------------------------------------
  // {
  //   siteName: "AJIO",
  //   match(url) { return /ajio\.com/i.test(url); },
  //   async scrape(page) {
  //     // TODO: add AJIO selectors here
  //   },
  // },
];

// ---------------------------------------------------------------------------
// Core scraper service
// ---------------------------------------------------------------------------

/**
 * Resolves the scraper config for a given URL.
 *
 * @param {string} url  Product URL
 * @returns {object}    Matching scraper config
 * @throws  {Error}     If no config matches the URL
 */
const resolveConfig = (url) => {
  const config = SCRAPER_CONFIGS.find((cfg) => cfg.match(url));
  if (!config) {
    throw new Error(
      `Unsupported site. Currently supported: ${SCRAPER_CONFIGS.map(
        (c) => c.siteName
      ).join(", ")}`
    );
  }
  return config;
};

/**
 * Launches a Puppeteer browser instance with stealth settings.
 * The browser is intentionally NOT headless so that sites that block
 * headless mode still render correctly (can switch to headless:"new"
 * in production if your server has a display or uses Xvfb).
 *
 * @returns {Promise<import('puppeteer').Browser>}
 */
const launchBrowser = async () => {
  return puppeteer.launch({
    headless: "new",           // Use the new headless mode (Chromium ≥ 112)
    args: [
      "--no-sandbox",          // Required in many Linux CI/server environments
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1366,768",
    ],
    defaultViewport: { width: 1366, height: 768 },
  });
};

/**
 * scrapeProduct
 *
 * Main entry point for the scraper service.
 * Given a product URL it will:
 *   1. Resolve the correct site config
 *   2. Launch a stealth Puppeteer browser
 *   3. Navigate to the URL with a random user-agent
 *   4. Apply a random human-like delay
 *   5. Delegate extraction to the site-specific scrape() fn
 *   6. Return a normalised product data object
 *
 * @param {string} url  Publicly accessible product URL
 * @returns {Promise<{
 *   title:    string,
 *   url:      string,
 *   siteName: string,
 *   currentPrice: number,
 *   image:    string,
 * }>}
 *
 * @throws {Error} Propagates meaningful errors for the controller to handle
 */
const scrapeProduct = async (url) => {
  // Step 1 – Resolve the correct scraper config for the given URL
  const config = resolveConfig(url);
  console.log(`[ScraperService] Resolved config: ${config.siteName} for ${url}`);

  let browser = null;
  let page = null;

  try {
    // Step 2 – Launch browser
    console.log("[ScraperService] Launching browser...");
    browser = await launchBrowser();

    // Step 3 – Open a new page and configure stealth headers
    page = await browser.newPage();

    // Set a random user-agent to avoid consistent browser fingerprinting
    const ua = randomUserAgent();
    await page.setUserAgent(ua);
    console.log(`[ScraperService] Using User-Agent: ${ua}`);

    // Mimic realistic HTTP Accept-Language and other headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });

    // Block image & font loading to speed up scraping (optional – comment out
    // if the site uses JS to load prices after image assets resolve)
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blockedTypes = ["font", "media"]; // keep "image" for src extraction
      if (blockedTypes.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Step 4 – Navigate to the product page
    console.log(`[ScraperService] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle2", // Wait until network is mostly idle
      timeout: 30000,            // 30 s max navigation timeout
    });

    // Step 5 – Human-like random delay (2–5 s) before scraping
    console.log("[ScraperService] Applying random delay...");
    await randomDelay();

    // Step 6 – Delegate to the site-specific scrape function
    console.log(`[ScraperService] Extracting data using ${config.siteName} config...`);
    const { title, price, image } = await config.scrape(page);

    // Validate that we actually got meaningful data
    if (!title) throw new Error(`${config.siteName}: Product title could not be extracted.`);
    if (!price || isNaN(price)) throw new Error(`${config.siteName}: Price could not be extracted or parsed.`);

    console.log(
      `[ScraperService] ✅ Scraped | Site: ${config.siteName} | Title: ${title} | Price: ₹${price}`
    );

    // Return a normalised object matching the Product schema
    return {
      title,
      url,
      siteName: config.siteName,
      currentPrice: price,
      image: image || "",
    };
  } catch (error) {
    // Log the full error internally, re-throw a clean message for the caller
    console.error(`[ScraperService] ❌ Error scraping ${url}:`, error.message);
    throw new Error(`Scraping failed for [${url}]: ${error.message}`);
  } finally {
    // Always close the browser – even on error – to free system resources
    if (browser) {
      await browser.close();
      console.log("[ScraperService] Browser closed.");
    }
  }
};

module.exports = { scrapeProduct };
