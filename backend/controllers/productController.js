/**
 * productController.js
 *
 * Express route handler functions for product management.
 * Each exported function maps directly to one API endpoint defined in
 * productRoutes.js. Keeping business logic here (out of routes) makes
 * each handler independently testable.
 *
 * Endpoints handled:
 *   POST /api/products  – validate URL → detect site → scrape → persist
 *   GET  /api/products  – return all tracked products (sorted newest first)
 *
 * Dependencies (injected via require, not instantiated here):
 *   Product          – Mongoose model  (models/Product.js)
 *   scraperService   – Puppeteer scraper  (services/scraperService.js)
 *   domainDetector   – URL validator + site key resolver  (utils/domainDetector.js)
 */

const Product        = require("../models/Product");
const { scrapeProduct }  = require("../services/scraperService");
const { detectDomain, isSupportedUrl } = require("../utils/domainDetector");

// ---------------------------------------------------------------------------
// Helper: standardised JSON response shapes
// ---------------------------------------------------------------------------

/**
 * Sends a successful JSON response.
 * @param {import('express').Response} res
 * @param {number}  statusCode  HTTP status (2xx)
 * @param {string}  message     Human-readable success message
 * @param {*}       data        Payload to include under the "data" key
 */
const sendSuccess = (res, statusCode, message, data) =>
  res.status(statusCode).json({ success: true, message, data });

/**
 * Sends an error JSON response.
 * @param {import('express').Response} res
 * @param {number}  statusCode  HTTP status (4xx / 5xx)
 * @param {string}  message     Human-readable error description
 * @param {*}       [details]   Optional extra context (omitted in production)
 */
const sendError = (res, statusCode, message, details = null) => {
  const body = { success: false, message };
  // Only attach internal details outside of production to avoid leaking info
  if (details && process.env.NODE_ENV !== "production") {
    body.details = details;
  }
  return res.status(statusCode).json(body);
};

// ---------------------------------------------------------------------------
// POST /api/products
// ---------------------------------------------------------------------------

/**
 * addProduct
 *
 * Accepts a product URL in the request body, scrapes the product page,
 * and persists the result in MongoDB.
 *
 * Request body:
 *   { "url": "https://www.amazon.in/dp/B09G3HRMVB" }
 *
 * Success responses:
 *   201 – product freshly scraped and saved to the database
 *   200 – product already exists; returns the existing document (no re-scrape)
 *
 * Error responses:
 *   400 – url field missing from request body
 *   422 – url is present but invalid or points to an unsupported site
 *   500 – scraping failed or a database error occurred
 *
 * Flow:
 *   1. Input validation       – ensure `url` field is present
 *   2. Format validation      – ensure it is a proper HTTP(S) URL
 *   3. Domain detection       – resolve the canonical site key ("amazon" etc.)
 *   4. Duplicate check        – return early if already in DB (by unique URL)
 *   5. Scrape                 – call scraperService.scrapeProduct()
 *   6. Persist                – save new Product document to MongoDB
 *   7. Respond                – 201 with the saved document
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const addProduct = async (req, res) => {
  // ── Step 1: Ensure the request body contains a url field ─────────────────
  const { url } = req.body;

  if (!url) {
    return sendError(
      res,
      400,
      "Request body must include a 'url' field."
    );
  }

  // ── Step 2: Validate URL format and check it belongs to a supported site ──
  if (!isSupportedUrl(url)) {
    // isSupportedUrl is a non-throwing boolean guard.
    // Run detectDomain to get the descriptive error message for the response.
    let reason = "URL is invalid or points to an unsupported site.";
    try {
      detectDomain(url); // will throw with the specific reason
    } catch (err) {
      // Strip the internal "[domainDetector]" prefix before sending to client
      reason = err.message.replace(/^\[domainDetector\]\s*/i, "");
    }
    return sendError(res, 422, reason);
  }

  // ── Step 3: Resolve canonical site key (e.g. "amazon", "flipkart") ───────
  // Safe to call without try/catch — we already verified isSupportedUrl above.
  const siteKey = detectDomain(url);
  console.log(`[productController] Site detected: ${siteKey} for URL: ${url}`);

  // ── Step 4: Duplicate check — URL field is unique-indexed in the schema ───
  // Query by the exact URL to prevent double-scraping the same product.
  const existing = await Product.findOne({ url }).lean();
  if (existing) {
    console.log(`[productController] Product already tracked: ${url}`);
    return sendSuccess(
      res,
      200,
      "Product is already being tracked.",
      existing
    );
  }

  // ── Step 5: Scrape the product page ───────────────────────────────────────
  let scrapedData;
  try {
    console.log(`[productController] Starting scrape for: ${url}`);
    scrapedData = await scrapeProduct(url);
    // scrapedData shape: { title, url, siteName, currentPrice, image }
  } catch (scrapeErr) {
    console.error(`[productController] Scrape failed for ${url}:`, scrapeErr.message);
    return sendError(
      res,
      500,
      "Failed to scrape the product. The page may be unavailable or bot-protected.",
      scrapeErr.message
    );
  }

  // ── Step 6: Build and persist the new Product document ───────────────────
  try {
    const newProduct = new Product({
      title:        scrapedData.title,
      url:          scrapedData.url,
      siteName:     scrapedData.siteName,
      currentPrice: scrapedData.currentPrice,
      image:        scrapedData.image,
      // Seed priceHistory with the first scraped price so the line chart
      // has an initial data point from the moment of creation.
      priceHistory: [
        {
          price:     scrapedData.currentPrice,
          timestamp: new Date(),
        },
      ],
    });

    const saved = await newProduct.save();
    console.log(`[productController] Product saved: "${saved.title}" @ ₹${saved.currentPrice}`);

    return sendSuccess(res, 201, "Product successfully tracked.", saved);
  } catch (dbErr) {
    // Handle Mongoose duplicate-key error (race condition: two requests for
    // the same URL arriving simultaneously before the findOne check above).
    if (dbErr.code === 11000) {
      const duplicate = await Product.findOne({ url }).lean();
      return sendSuccess(res, 200, "Product is already being tracked.", duplicate);
    }

    console.error("[productController] Database error while saving product:", dbErr.message);
    return sendError(
      res,
      500,
      "A database error occurred while saving the product.",
      dbErr.message
    );
  }
};

// ---------------------------------------------------------------------------
// GET /api/products
// ---------------------------------------------------------------------------

/**
 * getAllProducts
 *
 * Returns all tracked products stored in the database, sorted by creation
 * date (newest first). Each document includes the full price history array,
 * which the frontend uses to render the Recharts line graph.
 *
 * Success response:
 *   200 – array of product documents (may be empty [])
 *
 * Error response:
 *   500 – MongoDB query failure
 *
 * Query param support (optional, non-breaking):
 *   ?site=amazon     — filter by siteName (case-insensitive)
 *   ?limit=20        — cap the number of results (default: no limit)
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const getAllProducts = async (req, res) => {
  try {
    // Build an optional filter from query params
    const filter = {};

    // ?site=amazon → filter by siteName (case-insensitive partial match)
    if (req.query.site) {
      filter.siteName = { $regex: req.query.site, $options: "i" };
    }

    // Parse ?limit — default to 0 (Mongoose: 0 = no limit)
    const limit = parseInt(req.query.limit, 10) || 0;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 }) // newest first
      .limit(limit)
      .lean();                 // return plain JS objects (faster, no Mongoose overhead)

    return sendSuccess(
      res,
      200,
      `${products.length} product(s) retrieved.`,
      products
    );
  } catch (dbErr) {
    console.error("[productController] Failed to fetch products:", dbErr.message);
    return sendError(
      res,
      500,
      "Failed to retrieve products from the database.",
      dbErr.message
    );
  }
};

// ---------------------------------------------------------------------------
// GET /api/products/:id
// ---------------------------------------------------------------------------

/**
 * getProductById
 *
 * Returns a single product document by its MongoDB _id.
 * Useful for the product detail / price history view on the frontend.
 *
 * Success response:
 *   200 – the matching product document
 *
 * Error responses:
 *   400 – id param is not a valid MongoDB ObjectId format
 *   404 – no product found with the given id
 *   500 – database error
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const getProductById = async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId format before querying to avoid a Mongoose CastError
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 400, `"${id}" is not a valid product ID.`);
  }

  try {
    const product = await Product.findById(id).lean();

    if (!product) {
      return sendError(res, 404, `No product found with ID "${id}".`);
    }

    return sendSuccess(res, 200, "Product retrieved.", product);
  } catch (dbErr) {
    console.error(`[productController] Error fetching product ${id}:`, dbErr.message);
    return sendError(
      res,
      500,
      "Failed to retrieve the product.",
      dbErr.message
    );
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/products/:id
// ---------------------------------------------------------------------------

/**
 * deleteProduct
 *
 * Removes a product (and its price history) from the database by _id.
 * Called when the user removes a product from their dashboard.
 *
 * Success response:
 *   200 – product deleted
 *
 * Error responses:
 *   400 – invalid ObjectId
 *   404 – product not found
 *   500 – database error
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const deleteProduct = async (req, res) => {
  const { id } = req.params;

  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 400, `"${id}" is not a valid product ID.`);
  }

  try {
    const deleted = await Product.findByIdAndDelete(id).lean();

    if (!deleted) {
      return sendError(res, 404, `No product found with ID "${id}".`);
    }

    console.log(`[productController] Product deleted: "${deleted.title}" (${id})`);
    return sendSuccess(res, 200, "Product removed from tracking.", { id });
  } catch (dbErr) {
    console.error(`[productController] Error deleting product ${id}:`, dbErr.message);
    return sendError(
      res,
      500,
      "Failed to delete the product.",
      dbErr.message
    );
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  addProduct,      // POST /api/products
  getAllProducts,   // GET  /api/products
  getProductById,  // GET  /api/products/:id
  deleteProduct,   // DELETE /api/products/:id
};
