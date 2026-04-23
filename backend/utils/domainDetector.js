/**
 * domainDetector.js
 *
 * Utility that accepts a raw product URL and returns the canonical site key
 * used throughout the application (e.g. "amazon", "flipkart", "myntra", "ajio").
 *
 * Responsibilities:
 *  1. Validate that the input is a well-formed URL.
 *  2. Normalise the URL (strip www/m subdomains, query params, hash fragments).
 *  3. Match the hostname against the known-sites registry.
 *  4. Return the canonical site key — or throw a descriptive error.
 *
 * The returned key maps 1-to-1 with SCRAPER_CONFIG keys in scraperConfig.js,
 * so it can be used directly to look up selectors without additional mapping.
 *
 * Usage:
 *   const { detectDomain } = require('../utils/domainDetector');
 *   const siteKey = detectDomain("https://www.amazon.in/dp/B09G3HRMVB?tag=xyz");
 *   // → "amazon"
 */

// ---------------------------------------------------------------------------
// Known-sites registry
// ---------------------------------------------------------------------------
// Each entry defines:
//   key        – canonical identifier (matches scraperConfig.js keys)
//   siteName   – human-readable label for error messages / logs
//   patterns   – array of RegExp patterns tested against the *normalised* hostname
//
// Pattern order within each entry does not matter — all are tested.
// Entry order matters only if two entries could match the same hostname
// (which should never happen for the sites listed here).
// ---------------------------------------------------------------------------

const KNOWN_SITES = [
  {
    key: "amazon",
    siteName: "Amazon India",
    // Covers: amazon.in | www.amazon.in | smile.amazon.in
    // Also handles affiliate short-links that still resolve on amazon.in
    patterns: [/^amazon\.in$/i, /\.amazon\.in$/i],
  },
  {
    key: "flipkart",
    siteName: "Flipkart",
    // Covers: flipkart.com | www.flipkart.com | dl.flipkart.com (deep-links)
    patterns: [/^flipkart\.com$/i, /\.flipkart\.com$/i],
  },
  {
    key: "myntra",
    siteName: "Myntra",
    // Covers: myntra.com | www.myntra.com
    patterns: [/^myntra\.com$/i, /\.myntra\.com$/i],
  },
  {
    key: "ajio",
    siteName: "AJIO",
    // Covers: ajio.com | www.ajio.com
    patterns: [/^ajio\.com$/i, /\.ajio\.com$/i],
  },
];

// Flat list of supported site names — used in error messages.
const SUPPORTED_SITES = KNOWN_SITES.map((s) => s.siteName).join(", ");

// ---------------------------------------------------------------------------
// URL normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a string is a parseable, HTTP(S) URL.
 *
 * @param {string} raw  The raw input string
 * @returns {{ valid: boolean, url: URL | null, reason: string | null }}
 */
const parseUrl = (raw) => {
  if (!raw || typeof raw !== "string") {
    return { valid: false, url: null, reason: "URL must be a non-empty string." };
  }

  const trimmed = raw.trim();

  // Ensure the URL has a protocol — some users paste bare URLs
  const withProtocol =
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    // Only allow HTTP/HTTPS — reject ftp, file, mailto, etc.
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        valid: false,
        url: null,
        reason: `Unsupported protocol "${parsed.protocol}". Only http and https are allowed.`,
      };
    }

    return { valid: true, url: parsed, reason: null };
  } catch {
    return { valid: false, url: null, reason: `"${trimmed}" is not a valid URL.` };
  }
};

/**
 * Normalises a hostname by stripping common prefixes that don't affect
 * which e-commerce site a URL belongs to.
 *
 * Stripped prefixes:
 *   www.        – standard desktop subdomain
 *   m.          – mobile subdomain (e.g. m.flipkart.com)
 *   in.         – country code subdomain
 *   dl.         – deep-link subdomain (e.g. dl.flipkart.com)
 *   app.        – app-redirect subdomain
 *
 * Examples:
 *   "www.amazon.in"   → "amazon.in"
 *   "m.flipkart.com"  → "flipkart.com"
 *   "dl.flipkart.com" → "flipkart.com"
 *   "myntra.com"      → "myntra.com"  (no change)
 *
 * @param {string} hostname  Raw hostname from URL object (lowercase)
 * @returns {string}         Normalised hostname
 */
const normaliseHostname = (hostname) => {
  // Strip any of the known non-significant subdomains
  return hostname
    .toLowerCase()
    .replace(/^(www\.|m\.|in\.|dl\.|app\.)/, "");
};

// ---------------------------------------------------------------------------
// Core detection logic
// ---------------------------------------------------------------------------

/**
 * detectDomain
 *
 * Accepts any product URL from a supported Indian e-commerce site and returns
 * the canonical site key used by the scraper system.
 *
 * Handles:
 *  ✅ www / non-www variants          → "www.amazon.in" and "amazon.in" both → "amazon"
 *  ✅ Mobile URLs                     → "m.flipkart.com" → "flipkart"
 *  ✅ Deep-link / app subdomains      → "dl.flipkart.com" → "flipkart"
 *  ✅ Query parameters & hash frags   → stripped before matching
 *  ✅ URLs without protocol prefix    → auto-prepends "https://"
 *  ✅ Completely unsupported domains  → throws with a list of supported sites
 *  ✅ Malformed / empty strings       → throws with a clear validation message
 *
 * @param {string} rawUrl  Product page URL (can be messy / user-pasted)
 * @returns {string}       Canonical site key: "amazon" | "flipkart" | "myntra" | "ajio"
 * @throws  {Error}        Descriptive error for invalid or unsupported URLs
 *
 * @example
 * detectDomain("https://www.amazon.in/dp/B09G3HRMVB?tag=abc&linkCode=xyz");
 * // → "amazon"
 *
 * detectDomain("https://m.flipkart.com/product/p/itme?pid=SHOGYH3Z6VMHFNBA");
 * // → "flipkart"
 *
 * detectDomain("https://www.myntra.com/shirts/nike/123456/buy");
 * // → "myntra"
 *
 * detectDomain("https://www.ajio.com/nike-regular-fit-t-shirt/p/460343267_white");
 * // → "ajio"
 *
 * detectDomain("https://www.snapdeal.com/product/xyz");
 * // ✖ throws Error: Unsupported site ...
 */
const detectDomain = (rawUrl) => {
  // Step 1 — Validate and parse the URL
  const { valid, url, reason } = parseUrl(rawUrl);
  if (!valid) {
    throw new Error(`[domainDetector] Invalid URL — ${reason}`);
  }

  // Step 2 — Normalise the hostname (strip www, m., dl., etc.)
  const hostname = normaliseHostname(url.hostname);

  // Step 3 — Match against the known-sites registry
  for (const site of KNOWN_SITES) {
    if (site.patterns.some((regex) => regex.test(hostname))) {
      return site.key; // e.g. "amazon", "flipkart", "myntra", "ajio"
    }
  }

  // Step 4 — No match: throw a developer-friendly error
  throw new Error(
    `[domainDetector] Unsupported site: "${hostname}". ` +
    `Currently supported: ${SUPPORTED_SITES}.`
  );
};

// ---------------------------------------------------------------------------
// Secondary helpers (exported for use in validation middleware / controllers)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given URL belongs to a supported site, false otherwise.
 * Does NOT throw — safe to use in boolean guards.
 *
 * @param {string} rawUrl
 * @returns {boolean}
 *
 * @example
 * isSupportedUrl("https://www.flipkart.com/item");  // → true
 * isSupportedUrl("https://www.snapdeal.com/item");  // → false
 * isSupportedUrl("not-a-url");                      // → false
 */
const isSupportedUrl = (rawUrl) => {
  try {
    detectDomain(rawUrl);
    return true;
  } catch {
    return false;
  }
};

/**
 * Returns a list of all supported site keys.
 * Keys align directly with SCRAPER_CONFIG in scraperConfig.js.
 *
 * @returns {string[]}  e.g. ["amazon", "flipkart", "myntra", "ajio"]
 */
const getSupportedKeys = () => KNOWN_SITES.map((s) => s.key);

/**
 * Returns a list of all supported site display names.
 * Useful for API responses and validation error messages.
 *
 * @returns {string[]}  e.g. ["Amazon India", "Flipkart", "Myntra", "AJIO"]
 */
const getSupportedSiteNames = () => KNOWN_SITES.map((s) => s.siteName);

module.exports = {
  detectDomain,      // Primary export — used by productController
  isSupportedUrl,    // Guard helper — used in route-level validation middleware
  getSupportedKeys,  // Introspection — list of valid site keys
  getSupportedSiteNames, // Introspection — list of display names
};

// ---------------------------------------------------------------------------
// HOW TO ADD A NEW SITE
// ---------------------------------------------------------------------------
//
// 1. Add a new entry to KNOWN_SITES:
//
//      {
//        key: "meesho",
//        siteName: "Meesho",
//        patterns: [/^meesho\.com$/i, /\.meesho\.com$/i],
//      }
//
// 2. Add the corresponding entry to SCRAPER_CONFIG in scraperConfig.js.
//
// 3. Done — detectDomain() will automatically resolve URLs for the new site.
//    No changes needed in productController.js or scraperService.js.
//
// ---------------------------------------------------------------------------
