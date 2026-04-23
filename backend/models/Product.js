/**
 * Product.js
 *
 * Mongoose model for a tracked e-commerce product.
 *
 * Each document represents one product URL that is being monitored.
 * Price changes over time are appended to the priceHistory array by
 * the cron job (scraperService), giving the frontend enough data to
 * render a Recharts price-history line graph.
 */

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Sub-schema: a single price snapshot
// ---------------------------------------------------------------------------
// Stored as an array of these objects inside each Product document.
// Using a sub-schema (rather than a plain object) lets us add validation
// or virtuals to price snapshots in the future without a migration.
// ---------------------------------------------------------------------------
const priceSnapshotSchema = new mongoose.Schema(
  {
    /** The product price at the moment of scraping (in INR). */
    price: {
      type: Number,
      required: [true, "Snapshot price is required."],
      min: [0, "Price cannot be negative."],
    },

    /** Wall-clock time when this price was observed. Defaults to now. */
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Do not add a separate _id to each price snapshot — it wastes space
    // and is never used as a lookup key.
    _id: false,
  }
);

// ---------------------------------------------------------------------------
// Main product schema
// ---------------------------------------------------------------------------
const productSchema = new mongoose.Schema(
  {
    /** Product title as extracted from the product page. */
    title: {
      type: String,
      required: [true, "Product title is required."],
      trim: true,
    },

    /**
     * Full product URL.
     * Unique index ensures no duplicate products are stored regardless
     * of which controller path inserted the document.
     */
    url: {
      type: String,
      required: [true, "Product URL is required."],
      unique: true,
      trim: true,
    },

    /**
     * Canonical site identifier returned by domainDetector.
     * Values: "Amazon" | "Flipkart" | "Myntra" | "AJIO"
     * Stored as the human-readable siteName from scraperConfig (not the key).
     */
    siteName: {
      type: String,
      required: [true, "Site name is required."],
      trim: true,
    },

    /**
     * Most recently scraped price (in INR).
     * Updated in-place by the cron job whenever the price changes.
     * The full history is preserved in priceHistory[].
     */
    currentPrice: {
      type: Number,
      required: [true, "Current price is required."],
      min: [0, "Price cannot be negative."],
    },

    /**
     * URL of the main product image.
     * May be an empty string if the scraper could not extract an image.
     * Not required — some products (e.g. books) may not have a reliable
     * image selector.
     */
    image: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Ordered log of price observations.
     * The first entry is populated at creation time (by productController).
     * Subsequent entries are appended by the cron job only when the price
     * actually changes, keeping the array compact.
     */
    priceHistory: {
      type: [priceSnapshotSchema],
      default: [],
    },
  },
  {
    /**
     * Automatically manage createdAt and updatedAt fields.
     * createdAt → when the product was first added to tracking
     * updatedAt → when any field (including currentPrice) last changed
     */
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
// The unique constraint on `url` is already defined inline above, which
// creates a unique index automatically. We add a secondary index on
// `siteName` to make filtered GET /api/products?site=... queries fast.
productSchema.index({ siteName: 1 });

// ---------------------------------------------------------------------------
// Instance methods
// ---------------------------------------------------------------------------

/**
 * appendPrice(newPrice)
 *
 * Convenience method called by the cron job.
 * Appends a new price snapshot to priceHistory and updates currentPrice.
 * The caller is responsible for saving the document afterwards.
 *
 * @param {number} newPrice
 * @returns {void}
 *
 * @example
 * product.appendPrice(1299);
 * await product.save();
 */
productSchema.methods.appendPrice = function (newPrice) {
  this.currentPrice = newPrice;
  this.priceHistory.push({ price: newPrice, timestamp: new Date() });
};

// ---------------------------------------------------------------------------
// Model export
// ---------------------------------------------------------------------------
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
