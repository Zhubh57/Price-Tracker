/**
 * db.js
 *
 * MongoDB connection manager using Mongoose.
 *
 * Usage:
 *   const connectDB = require('./config/db');
 *   await connectDB();
 *
 * The connection is established once at startup (in server.js) and reused
 * across all requests via Mongoose's internal connection pool.
 *
 * Environment variables (backend/.env):
 *   MONGO_URI  – MongoDB connection string (SRV or standard format)
 *
 * Connection string formats:
 *   Atlas SRV:  mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority
 *   Standard:   mongodb://<user>:<pass>@<host>:27017/<db>
 *   Local:      mongodb://localhost:27017/price-tracker
 */

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Connection options
// ---------------------------------------------------------------------------
// serverSelectionTimeoutMS: how long the driver waits to find an available
//   server before throwing. Default is 30 s — we reduce to 10 s so the error
//   surfaces faster during development and CI.
//
// connectTimeoutMS: how long to wait for a single TCP connection to open.
//
// socketTimeoutMS: how long an idle socket can sit before being closed.
//   Set to 0 (never) for long-running processes like an Express server.
// ---------------------------------------------------------------------------
const MONGOOSE_OPTIONS = {
  serverSelectionTimeoutMS: 10000,  // 10 s — fail fast with a clear error
  connectTimeoutMS:         10000,  // 10 s TCP handshake timeout
  socketTimeoutMS:          0,      // never time out idle sockets
};

// ---------------------------------------------------------------------------
// Error classifier
// ---------------------------------------------------------------------------
// Maps raw Mongoose/MongoDB driver error codes to human-readable guidance.
// Shown only in development so the console is actually useful.
// ---------------------------------------------------------------------------

/**
 * Returns an actionable hint for a given connection error.
 * @param {Error} err  The error thrown by mongoose.connect()
 * @returns {string}   A human-readable fix suggestion
 */
const classifyError = (err) => {
  const msg = err.message || "";
  const code = err.code   || "";

  // Atlas SRV DNS resolution failure — most common issue
  if (msg.includes("querySrv") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return [
      "🔍 Diagnosis: DNS/Network failure reaching MongoDB Atlas.",
      "   Possible causes & fixes:",
      "   1. IP not whitelisted → Atlas Dashboard → Network Access → Add 0.0.0.0/0",
      "   2. Cluster is paused  → Atlas Dashboard → Database → Click 'Resume'",
      "   3. Wrong cluster name → verify the hostname in MONGO_URI matches your Atlas cluster",
      "   4. Corporate firewall → try a mobile hotspot or home network",
      "   5. Use non-SRV URI    → see MONGO_URI_FALLBACK comment in .env",
    ].join("\n");
  }

  // Authentication failure
  if (msg.includes("Authentication failed") || msg.includes("bad auth") || code === 18) {
    return [
      "🔐 Diagnosis: Authentication failure.",
      "   Possible causes & fixes:",
      "   1. Wrong password    → check MONGO_URI password in .env",
      "   2. Wrong username    → verify Atlas DB user credentials",
      "   3. Special chars     → URL-encode special chars in password (e.g. @ → %40)",
    ].join("\n");
  }

  // Server selection timeout (cluster unreachable but DNS resolved)
  if (msg.includes("Server selection timed out") || msg.includes("ETIMEDOUT")) {
    return [
      "⏱  Diagnosis: Server selection timed out.",
      "   Possible causes & fixes:",
      "   1. IP not whitelisted → Atlas → Network Access → Add your IP or 0.0.0.0/0",
      "   2. Atlas cluster paused → Resume from Atlas dashboard",
      "   3. VPN interference   → disconnect VPN and retry",
    ].join("\n");
  }

  // URI parsing issues
  if (msg.includes("Invalid connection string") || msg.includes("URI")) {
    return [
      "📝 Diagnosis: Malformed connection string.",
      "   Fix: Check MONGO_URI in backend/.env for typos.",
      "   SRV format:  mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority",
      "   Local format: mongodb://localhost:27017/price-tracker",
    ].join("\n");
  }

  // Generic fallback
  return `⚠️  Error code: ${code || "N/A"} — check MongoDB Atlas dashboard and network connectivity.`;
};

// ---------------------------------------------------------------------------
// connectDB — main exported function
// ---------------------------------------------------------------------------

/**
 * Opens a Mongoose connection to the MongoDB instance defined by MONGO_URI.
 *
 * On failure:
 *  - Logs a human-readable diagnosis (development only)
 *  - Calls process.exit(1) so the process manager (PM2/Docker) can restart
 *
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  // ── Guard: MONGO_URI must be set ─────────────────────────────────────────
  if (!process.env.MONGO_URI) {
    console.error(
      "\n[DB] ❌ MONGO_URI is not defined.\n" +
      "   → Create backend/.env and add: MONGO_URI=mongodb+srv://...\n"
    );
    process.exit(1);
  }

  // Log which URI type is being attempted (never log the full URI — it has credentials)
  const uriType = process.env.MONGO_URI.startsWith("mongodb+srv://")
    ? "Atlas SRV (mongodb+srv://)"
    : "Standard (mongodb://)";

  console.log(`[DB] 🔌 Connecting via ${uriType} ...`);

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, MONGOOSE_OPTIONS);

    console.log(
      `[DB] ✅ MongoDB connected!\n` +
      `     Host:     ${conn.connection.host}\n` +
      `     Database: ${conn.connection.name}`
    );
  } catch (err) {
    // Log the raw error always
    console.error(`\n[DB] ❌ Connection failed: ${err.message}`);

    // Log the actionable diagnosis in non-production environments
    if (process.env.NODE_ENV !== "production") {
      console.error("\n" + classifyError(err) + "\n");
    }

    process.exit(1);
  }
};

// ---------------------------------------------------------------------------
// Mongoose runtime event listeners
// ---------------------------------------------------------------------------
// These fire AFTER the initial connection succeeds and handle runtime events
// such as temporary network outages or Atlas maintenance windows.

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] ⚠️  MongoDB disconnected — Mongoose will auto-reconnect.");
});

mongoose.connection.on("reconnected", () => {
  console.log("[DB] 🔄 MongoDB reconnected.");
});

mongoose.connection.on("error", (err) => {
  // Do NOT exit here — Mongoose reconnect logic handles transient errors.
  console.error(`[DB] ❌ Runtime error: ${err.message}`);
});

module.exports = connectDB;
