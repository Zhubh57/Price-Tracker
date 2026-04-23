/**
 * productRoutes.js
 *
 * Express Router for all product-related API endpoints.
 *
 * Intentionally thin — this file contains no business logic.
 * All handler functions live in productController.js.
 *
 * Mounted at: /api/products  (configured in server.js)
 *
 * Full route table:
 *   POST   /api/products       → addProduct      (track a new product)
 *   GET    /api/products       → getAllProducts   (list all tracked products)
 *   GET    /api/products/:id   → getProductById  (single product + price history)
 *   DELETE /api/products/:id   → deleteProduct   (stop tracking a product)
 */

const express = require("express");
const router  = express.Router();

const {
  addProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
} = require("../controllers/productController");

// ---------------------------------------------------------------------------
// Collection-level routes  →  /api/products
// ---------------------------------------------------------------------------

/**
 * POST /api/products
 * Body: { "url": "<product-url>" }
 * Validates the URL, detects the site, scrapes, and persists a new product.
 */
router.post("/", addProduct);

/**
 * GET /api/products
 * Optional query params: ?site=amazon  ?limit=20
 * Returns all tracked products sorted by creation date (newest first).
 */
router.get("/", getAllProducts);

// ---------------------------------------------------------------------------
// Resource-level routes  →  /api/products/:id
// ---------------------------------------------------------------------------

/**
 * GET /api/products/:id
 * Returns a single product document (includes full priceHistory array).
 */
router.get("/:id", getProductById);

/**
 * DELETE /api/products/:id
 * Removes a product and its price history from the database.
 */
router.delete("/:id", deleteProduct);

module.exports = router;
