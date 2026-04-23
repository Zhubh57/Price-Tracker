import { useState, useEffect, useCallback } from 'react';
import AddProduct from '../components/AddProduct';
import ProductCard from '../components/ProductCard';
import { getProducts } from '../services/api';

// ---------------------------------------------------------------------------
// Realistic mock data — shown when the API is unreachable
// ---------------------------------------------------------------------------
const MOCK_PRODUCTS = [
  {
    _id: 'mock-1',
    title: 'Apple iPhone 15 (128GB) — Black Titanium',
    url: 'https://www.amazon.in/',
    siteName: 'Amazon',
    currentPrice: 72900,
    image: 'https://m.media-amazon.com/images/I/61lYZNm+r1L._SX679_.jpg',
    priceHistory: [
      { price: 79900, timestamp: '2026-01-01T00:00:00Z' },
      { price: 76900, timestamp: '2026-02-01T00:00:00Z' },
      { price: 74500, timestamp: '2026-03-01T00:00:00Z' },
      { price: 72900, timestamp: '2026-04-01T00:00:00Z' },
    ],
    updatedAt: '2026-04-23T00:00:00Z',
  },
  {
    _id: 'mock-2',
    title: 'Samsung Galaxy S24 Ultra 5G (256GB)',
    url: 'https://www.flipkart.com/',
    siteName: 'Flipkart',
    currentPrice: 109999,
    image: 'https://rukminim2.flixcart.com/image/832/832/xif0q/mobile/e/o/s/-original-imaghx9qnmhqzrhx.jpeg',
    priceHistory: [
      { price: 124999, timestamp: '2026-01-01T00:00:00Z' },
      { price: 117999, timestamp: '2026-02-15T00:00:00Z' },
      { price: 109999, timestamp: '2026-04-01T00:00:00Z' },
    ],
    updatedAt: '2026-04-23T00:00:00Z',
  },
  {
    _id: 'mock-3',
    title: 'Nike Air Max 270 Running Shoes — White/Black',
    url: 'https://www.myntra.com/',
    siteName: 'Myntra',
    currentPrice: 7495,
    image: 'https://assets.myntassets.com/h_1440,q_90,w_1080/v1/assets/images/16261974/2022/2/16/d0f4c0e9-2f95-4f7c-97bd-a25eada7b5321644996754386-Nike-Men-Shoes-7481644996753682-1.jpg',
    priceHistory: [
      { price: 9995, timestamp: '2026-01-01T00:00:00Z' },
      { price: 8995, timestamp: '2026-02-20T00:00:00Z' },
      { price: 7495, timestamp: '2026-04-10T00:00:00Z' },
    ],
    updatedAt: '2026-04-23T00:00:00Z',
  },
  {
    _id: 'mock-4',
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    url: 'https://www.amazon.in/',
    siteName: 'Amazon',
    currentPrice: 24990,
    image: 'https://m.media-amazon.com/images/I/61+btxzpfDL._SX679_.jpg',
    priceHistory: [
      { price: 29990, timestamp: '2026-01-15T00:00:00Z' },
      { price: 27490, timestamp: '2026-02-28T00:00:00Z' },
      { price: 24990, timestamp: '2026-04-01T00:00:00Z' },
    ],
    updatedAt: '2026-04-23T00:00:00Z',
  },
];

// Site filter tabs
const SITE_FILTERS = ['All', 'Amazon', 'Flipkart', 'Myntra', 'AJIO'];

/**
 * Dashboard page
 * Entry page of the app. Handles data fetching, filtering, and
 * orchestrates AddProduct, ProductCard components.
 */
export default function Dashboard() {
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [siteFilter,  setSiteFilter]  = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [usingMock,   setUsingMock]   = useState(false);

  // ── Fetch products from API ───────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts();
      setProducts(data || []);
      setUsingMock(false);
    } catch {
      // Fall back to mock data if the API is unavailable
      setProducts(MOCK_PRODUCTS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Handle new product added via AddProduct component ────────────────────
  const handleProductAdded = (newProduct) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  // ── Handle product removal from ProductCard ───────────────────────────────
  const handleProductDeleted = (id) => {
    setProducts((prev) => prev.filter((p) => p._id !== id));
  };

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    const matchesSite = siteFilter === 'All' || p.siteName === siteFilter;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSite && matchesSearch;
  });

  // ── Stats bar data ────────────────────────────────────────────────────────
  const totalTracked  = products.length;
  const droppedCount  = products.filter((p) => {
    const first = p.priceHistory?.[0]?.price ?? p.currentPrice;
    return p.currentPrice < first;
  }).length;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">

      {/* ── Top navigation bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(10,10,15,0.85)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold shadow-lg">
              📊
            </div>
            <span className="text-lg font-bold tracking-tight">PriceTracker</span>
          </div>

          {/* Refresh button */}
          <button
            id="refresh-btn"
            onClick={fetchProducts}
            disabled={loading}
            title="Refresh"
            className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center
                       text-[var(--text-muted)] hover:text-white hover:border-[var(--accent)] transition-colors duration-150"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Add product section ───────────────────────────────────────── */}
        <section className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            Track Product Prices
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Paste any Amazon, Flipkart, Myntra, or AJIO product URL to start tracking.
          </p>
          <AddProduct onProductAdded={handleProductAdded} />
        </section>

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Products Tracked', value: totalTracked, icon: '📦' },
            { label: 'Price Drops',       value: droppedCount,  icon: '📉' },
            { label: 'Sites Supported',   value: 4,             icon: '🌐' },
          ].map((stat) => (
            <div key={stat.label} className="card px-4 py-4 flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Mock data notice ──────────────────────────────────────────── */}
        {usingMock && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-yellow-500/20
                          bg-yellow-500/10 text-yellow-300 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>
              API is unavailable — showing demo data.
              Make sure the backend is running on port 5000.
            </span>
          </div>
        )}

        {/* ── Filters row ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Site filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {SITE_FILTERS.map((site) => (
              <button
                key={site}
                id={`filter-${site.toLowerCase()}`}
                onClick={() => setSiteFilter(site)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border
                  ${siteFilter === site
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-white'
                  }`}
              >
                {site}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative sm:ml-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input
              id="search-products"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="input-field pl-9 pr-4 py-2 text-sm w-full sm:w-52"
            />
          </div>
        </div>

        {/* ── Products grid ─────────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton loader */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse overflow-hidden">
                <div className="aspect-square bg-[var(--bg-card-hover)]" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-[var(--bg-card-hover)] rounded w-1/3" />
                  <div className="h-4 bg-[var(--bg-card-hover)] rounded w-full" />
                  <div className="h-4 bg-[var(--bg-card-hover)] rounded w-2/3" />
                  <div className="h-6 bg-[var(--bg-card-hover)] rounded w-1/2 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-6xl mb-4 opacity-40">📭</span>
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">
              {products.length === 0 ? 'No products tracked yet' : 'No results found'}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {products.length === 0
                ? 'Paste a product URL above to get started.'
                : 'Try a different search term or site filter.'}
            </p>
          </div>
        ) : (
          /* Product cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onDelete={handleProductDeleted}
              />
            ))}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="mt-16 pb-8 text-center text-xs text-[var(--text-muted)]">
          Price data refreshes every 12 hours via background cron job.
          All prices in ₹ (Indian Rupees).
        </footer>
      </main>
    </div>
  );
}
