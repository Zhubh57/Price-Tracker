/**
 * scraperConfig.js
 *
 * Centralised CSS selector configuration for all supported scraper sites.
 *
 * Design principles:
 *  - One config entry per site, keyed by a short site identifier.
 *  - Every field supports an array of selectors tried in order (fallbacks).
 *  - scraperService reads this config dynamically — adding a new site requires
 *    only a new entry here, with zero changes to the service logic.
 *
 * Selector arrays:
 *  The first selector is the primary (most reliable / stable).
 *  Subsequent selectors are fallbacks for alternate page templates, A/B tests,
 *  or category-specific layouts that the site may serve.
 *
 * Supported sites: Amazon, Flipkart, Myntra, AJIO
 */

/**
 * @typedef {Object} FieldSelectors
 * @property {string[]} selectors  Ordered list of CSS selectors to try
 * @property {string}   attribute  DOM attribute to read (default: "textContent")
 *                                 Use "src" for images, "data-old-hires" etc. for
 *                                 attribute-based values.
 */

/**
 * @typedef {Object} SiteConfig
 * @property {string}         siteName    Human-readable site label (stored in DB)
 * @property {RegExp}         urlPattern  Regex to match URLs belonging to this site
 * @property {FieldSelectors} title       Selector config for the product title
 * @property {FieldSelectors} price       Selector config for the current price
 * @property {FieldSelectors} image       Selector config for the main product image
 * @property {string}         waitFor     A CSS selector guaranteed to appear when
 *                                        the core content has loaded. Used by the
 *                                        service as the page-ready signal.
 */

/** @type {Object.<string, SiteConfig>} */
const SCRAPER_CONFIG = {

  // ---------------------------------------------------------------------------
  // Amazon India
  // ---------------------------------------------------------------------------
  // Amazon uses different DOM structures depending on:
  //   • Product category (electronics vs. books vs. fashion)
  //   • "New" vs. "Legacy" detail-page template
  //   • A/B tests (layout shifts happen frequently)
  // Fallback selectors are ordered from most-specific to most-generic.
  // ---------------------------------------------------------------------------
  amazon: {
    siteName: "Amazon",

    // Matches amazon.in (with or without www/subdomain)
    urlPattern: /amazon\.in/i,

    // The service waits for this selector before attempting extraction.
    // #productTitle is present on virtually every Amazon product page.
    waitFor: "#productTitle",

    title: {
      selectors: [
        "#productTitle",           // Primary – most product categories
        "#title",                  // Alternate wrapper (some legacy pages)
        "h1.product-title-word-break", // Kindle / digital products
      ],
      attribute: "textContent",
    },

    price: {
      selectors: [
        ".priceToPay .a-price-whole",          // "Price to Pay" block (most listings)
        "#priceblock_ourprice",                 // Legacy "Our Price" block
        "#priceblock_dealprice",                // Lightning deal / coupon price
        ".a-price.a-text-price .a-offscreen",   // Generic price (some fashion items)
        "#tp_price_block_total_price_ww .a-price-whole", // Some electronics bundles
        ".apexPriceToPay .a-price-whole",       // Subscribe & Save pages
      ],
      attribute: "textContent",
    },

    image: {
      selectors: [
        "#landingImage",       // Primary image (most product detail pages)
        "#imgBlkFront",        // Book / media front cover
        ".a-dynamic-image",    // Dynamic/lazy-loaded image block
        "#main-image",         // Older template fallback
      ],
      // Amazon stores the high-res URL in a data attribute, not src.
      // scraperService checks data-old-hires first, then falls back to src.
      attribute: "data-old-hires|src",
    },
  },

  // ---------------------------------------------------------------------------
  // Flipkart
  // ---------------------------------------------------------------------------
  // Flipkart is a React SPA. DOM class names are obfuscated and change often.
  // The selectors below are verified as of Q2 2025 but may drift.
  // Always add a fallback when a class name changes are observed.
  // ---------------------------------------------------------------------------
  flipkart: {
    siteName: "Flipkart",

    urlPattern: /flipkart\.com/i,

    // Flipkart's product title is the first stable element to appear
    waitFor: ".B_NuCI, .yhB1nd",

    title: {
      selectors: [
        ".B_NuCI",             // Primary – most product categories
        ".yhB1nd",             // Fashion / apparel pages
        "h1.product-title",    // Some older listing templates
        "h1",                  // Last-resort generic h1
      ],
      attribute: "textContent",
    },

    price: {
      selectors: [
        "._30jeq3._16Jk6d",   // Selling price with discount styling (most products)
        "._30jeq3",            // Selling price (no discount)
        ".CEmiEU ._30jeq3",    // Alternate price container (some categories)
        "._25b18 ._30jeq3",    // Grocery / FMCG pages
      ],
      attribute: "textContent",
    },

    image: {
      selectors: [
        "._396cs4._2amPTt._3qGmMb", // Primary product image
        ".CXW8mj img",               // Image container wrapper
        "img._2r_T1I",               // Fashion / footwear image
        "img._396cs4",               // Generic image element
      ],
      attribute: "src",
    },
  },

  // ---------------------------------------------------------------------------
  // Myntra
  // ---------------------------------------------------------------------------
  // Myntra is a React SPA with server-side rendered initial HTML.
  // The page uses a mix of BEM class names and data attributes.
  // ---------------------------------------------------------------------------
  myntra: {
    siteName: "Myntra",

    urlPattern: /myntra\.com/i,

    // Wait for the product title heading to mount
    waitFor: ".pdp-title, h1.pdp-name",

    title: {
      selectors: [
        "h1.pdp-name",            // Primary product name
        ".pdp-title",             // Full title block (brand + name)
        ".title-container h1",    // Alternate wrapper
      ],
      attribute: "textContent",
    },

    price: {
      selectors: [
        ".pdp-price strong",       // Discounted price (most listings)
        ".pdp-mrp",                // MRP (used when no discount)
        "span.pdp-price",          // Generic price span
        ".pdp-discount-container .pdp-price strong", // Within discount section
      ],
      attribute: "textContent",
    },

    image: {
      selectors: [
        ".image-grid-image",       // Main product image grid
        "img.pdp-image",           // Direct image element
        ".pdp-img img",            // Wrapper → img
      ],
      attribute: "src",
    },
  },

  // ---------------------------------------------------------------------------
  // AJIO
  // ---------------------------------------------------------------------------
  // AJIO is a React SPA. Product data is injected via JSON-LD and hydrated
  // into the DOM. The selectors below target the hydrated DOM elements.
  // ---------------------------------------------------------------------------
  ajio: {
    siteName: "AJIO",

    urlPattern: /ajio\.com/i,

    // Wait for the product brand/name section to mount
    waitFor: ".prod-name, .brand-name",

    title: {
      selectors: [
        ".prod-name",              // Product name text
        ".brand-name",             // Brand label (sometimes used as title fallback)
        "h1.prod-name",            // H1 variant on some templates
        ".prod-details h1",        // Generic h1 within product details section
      ],
      attribute: "textContent",
    },

    price: {
      selectors: [
        ".prod-sp",                // Selling price (most listings)
        "strong.prod-sp",          // Bold selling price
        ".price-details .prod-sp", // Within price details wrapper
        ".orig-price",             // Original/MRP price (fallback if no discount)
      ],
      attribute: "textContent",
    },

    image: {
      selectors: [
        ".zoom-wrap img",          // Primary zoomable product image
        ".rilrtl-images-slot img", // Image slot (thumbnail grid)
        "img.prod-img",            // Direct product image
        ".product-image img",      // Generic product image wrapper
      ],
      attribute: "src",
    },
  },
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Resolves and returns the scraper config for a given product URL.
 * Iterates over all configs and returns the first one whose urlPattern matches.
 *
 * @param {string} url  Product page URL
 * @returns {SiteConfig}  Matching site config object
 * @throws  {Error}       If no configured site matches the URL
 *
 * @example
 * const config = getConfigForUrl("https://www.amazon.in/dp/B09G3HRMVB");
 * // → SCRAPER_CONFIG.amazon
 */
const getConfigForUrl = (url) => {
  const entry = Object.values(SCRAPER_CONFIG).find((cfg) =>
    cfg.urlPattern.test(url)
  );

  if (!entry) {
    const supported = Object.values(SCRAPER_CONFIG)
      .map((c) => c.siteName)
      .join(", ");
    throw new Error(
      `No scraper config found for URL: "${url}". Supported sites: ${supported}`
    );
  }

  return entry;
};

/**
 * Returns an array of all configured site names.
 * Useful for logging, UI dropdowns, and validation messages.
 *
 * @returns {string[]}  e.g. ["Amazon", "Flipkart", "Myntra", "AJIO"]
 */
const getSupportedSites = () =>
  Object.values(SCRAPER_CONFIG).map((cfg) => cfg.siteName);

module.exports = {
  SCRAPER_CONFIG,   // Full config map — use directly if you need all sites
  getConfigForUrl,  // Primary helper used by scraperService
  getSupportedSites,
};

// ---------------------------------------------------------------------------
// HOW TO ADD A NEW SITE
// ---------------------------------------------------------------------------
//
// 1. Add a new key to SCRAPER_CONFIG (e.g. "meesho")
// 2. Fill in:
//      siteName   – display name
//      urlPattern – regex matching the site's domain
//      waitFor    – a CSS selector present when core content has loaded
//      title      – selector array + attribute
//      price      – selector array + attribute
//      image      – selector array + attribute
// 3. Done. scraperService.js picks it up automatically via getConfigForUrl().
//
// No other files need to be modified.
// ---------------------------------------------------------------------------
