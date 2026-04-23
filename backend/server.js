/**
 * server.js
 *
 * Application entry point for the Price Tracker backend.
 *
 * Responsibilities:
 *  1. Load environment variables from .env
 *  2. Connect to MongoDB
 *  3. Bootstrap the Express app (middleware + routes)
 *  4. Start the HTTP server
 *
 * Start the server:
 *   node server.js          (production)
 *   nodemon server.js       (development)
 *   npm run dev             (if nodemon is configured in package.json)
 */

// Load .env from the same directory as server.js (__dirname = backend/).
// This ensures the correct .env is found whether the process is started
// from inside /backend OR from the project root via `npm run dev`.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express       = require("express");
const cors          = require("cors");
const connectDB     = require("./config/db");
const productRoutes = require("./routes/productRoutes");

// ---------------------------------------------------------------------------
// 1. Connect to MongoDB
// ---------------------------------------------------------------------------
// connectDB() will call process.exit(1) if the connection fails, so the
// server never starts in a broken state.
connectDB();

// ---------------------------------------------------------------------------
// 2. Initialise Express app
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// 3. Global middleware
// ---------------------------------------------------------------------------

/**
 * CORS
 * Allows the React frontend (running on a different port in development)
 * to call this API without browser CORS errors.
 * In production, restrict the origin to your deployed frontend domain.
 */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*", // e.g. "https://price-tracker.example.com"
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

/**
 * JSON body parser
 * Parses incoming requests with JSON payloads (Content-Type: application/json).
 * The 10kb limit prevents excessively large request bodies.
 */
app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------------------
// 4. API routes
// ---------------------------------------------------------------------------

/**
 * Health-check endpoint.
 * Useful for load balancers, Docker HEALTHCHECK, and uptime monitors.
 * Returns 200 with a minimal JSON payload — no DB query needed.
 */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Price Tracker API is running.",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Product routes
 * All requests to /api/products (and /api/products/:id) are handled here.
 */
app.use("/api/products", productRoutes);

// ---------------------------------------------------------------------------
// 5. 404 handler — catches any route not matched above
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found. Check the API documentation.",
  });
});

// ---------------------------------------------------------------------------
// 6. Global error handler
// ---------------------------------------------------------------------------
// Express recognises a 4-parameter middleware as an error handler.
// Any call to next(err) from a route or middleware lands here.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred."  // hide internals in production
      : err.message;

  res.status(statusCode).json({ success: false, message });
});

const { startCronJobs } = require("./services/cronService");

// ---------------------------------------------------------------------------
// 7. Start the HTTP server & Cron Jobs
// ---------------------------------------------------------------------------
startCronJobs();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `[server] 🚀 Price Tracker API running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`
  );
  console.log(`[server] 🏥 Health check → http://localhost:${PORT}/api/health`);
});

module.exports = app; // exported for integration testing (e.g. supertest)
