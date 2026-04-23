/**
 * cronService.js
 *
 * Scheduled background jobs using node-cron.
 * 
 * Responsibilities:
 * - Periodically re-scrape all tracked products in the database.
 * - Detect price changes.
 * - Update the current price and append to the priceHistory array.
 * 
 * Schedule: Runs every 12 hours (e.g., 00:00 and 12:00).
 */

const cron = require("node-cron");
const Product = require("../models/Product");
const { scrapeProduct } = require("./scraperService");

/**
 * Executes the main price update job for all products in the database.
 */
const updateAllPrices = async () => {
  console.log(`\n[CronService] 🔄 Job Started: Updating prices for all products at ${new Date().toISOString()}`);

  try {
    // Fetch all tracked products. Use full Mongoose documents so we can use the appendPrice method.
    const products = await Product.find({});
    
    if (products.length === 0) {
      console.log("[CronService] No products currently tracked. Skipping job.");
      return;
    }

    console.log(`[CronService] Found ${products.length} product(s) to update.`);

    // Loop through each product sequentially to avoid overloading the scraper/browser.
    // Do NOT stop the loop if one product fails.
    for (const product of products) {
      try {
        console.log(`[CronService] Scraping: ${product.url}`);
        const scrapedData = await scrapeProduct(product.url);
        const newPrice = scrapedData.currentPrice;

        // Check if price has changed
        if (newPrice !== product.currentPrice) {
          console.log(`[CronService] 📉 Price changed for "${product.title}": ₹${product.currentPrice} -> ₹${newPrice}`);
          
          // Append the new price using the Mongoose model instance method
          product.appendPrice(newPrice);
          await product.save();
          
          console.log(`[CronService] ✅ Saved new price history for "${product.title}"`);
        } else {
          console.log(`[CronService] ➖ No price change for "${product.title}". Current: ₹${product.currentPrice}`);
        }
      } catch (scrapeErr) {
        // Log the error but continue to the next product in the loop
        console.error(`[CronService] ❌ Failed to update product ID ${product._id}:`, scrapeErr.message);
      }
    }

    console.log(`[CronService] ✨ Job Completed: All products processed at ${new Date().toISOString()}\n`);
  } catch (dbErr) {
    // This catches top-level database errors (e.g., failed to fetch products list)
    console.error("[CronService] ❌ Critical failure during cron job:", dbErr.message);
  }
};

/**
 * Initializes and starts all configured cron jobs.
 * This should be called once during server startup.
 */
const startCronJobs = () => {
  console.log("[CronService] 🕒 Scheduling price update job (runs every 12 hours).");
  
  // Schedule: '0 */12 * * *' means minute 0, past every 12th hour.
  cron.schedule("0 */12 * * *", () => {
    updateAllPrices();
  });
};

module.exports = {
  startCronJobs,
  updateAllPrices // Exported for manual triggering/testing if needed
};
