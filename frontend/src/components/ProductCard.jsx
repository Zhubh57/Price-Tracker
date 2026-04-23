import { useState } from 'react';
import PriceChart from './PriceChart';
import { deleteProduct } from '../services/api';
import toast from 'react-hot-toast';

// Map each site to its brand colour for the accent dot
const SITE_COLOURS = {
  Amazon:   '#ff9900',
  Flipkart: '#2874f0',
  Myntra:   '#ff3f6c',
  AJIO:     '#e63329',
};

// Map each site to its emoji logo (avoids image hosting for logos)
const SITE_LOGOS = {
  Amazon:   '🛒',
  Flipkart: '🛍️',
  Myntra:   '👗',
  AJIO:     '👟',
};

const formatPrice = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

/**
 * ProductCard
 * Displays a tracked product with image, title, price, site badge,
 * and a "Price Dropped" badge if the current price is below the first
 * recorded price. Clicking expands an inline chart modal.
 *
 * @param {{ product: object, onDelete: (id: string) => void }} props
 */
export default function ProductCard({ product, onDelete }) {
  const [expanded, setExpanded]   = useState(false);
  const [deleting, setDeleting]   = useState(false);

  // Check if the current price is lower than the first historical price
  const firstPrice   = product.priceHistory?.[0]?.price ?? product.currentPrice;
  const priceDropped = product.currentPrice < firstPrice;
  const siteColour   = SITE_COLOURS[product.siteName] || '#6c63ff';

  const handleDelete = async (e) => {
    e.stopPropagation(); // prevent card expand
    if (!window.confirm('Stop tracking this product?')) return;
    setDeleting(true);
    try {
      await deleteProduct(product._id);
      toast.success('Product removed from tracking.');
      onDelete?.(product._id);
    } catch {
      toast.error('Failed to remove product.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* ── Product card ──────────────────────────────────────────────── */}
      <article
        id={`product-card-${product._id}`}
        className="card cursor-pointer flex flex-col overflow-hidden"
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(true)}
        aria-label={`View price history for ${product.title}`}
      >
        {/* Product image */}
        <div className="relative w-full aspect-square bg-[#0d0d14] flex items-center justify-center overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="object-contain w-full h-full p-4 transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { e.currentTarget.src = ''; e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="text-5xl select-none">
              {SITE_LOGOS[product.siteName] ?? '📦'}
            </span>
          )}

          {/* Price Dropped badge */}
          {priceDropped && (
            <span className="badge-drop absolute top-3 left-3 px-2 py-1">
              📉 Price Dropped
            </span>
          )}

          {/* Delete button */}
          <button
            id={`delete-btn-${product._id}`}
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Remove product"
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[rgba(0,0,0,0.6)] border border-[var(--border)]
                       flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--red)]
                       hover:border-[var(--red)] transition-colors duration-150"
          >
            {deleting ? (
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            )}
          </button>
        </div>

        {/* Card body */}
        <div className="flex flex-col gap-3 p-4 flex-1">
          {/* Site badge */}
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: siteColour }}
            />
            <span className="badge-site px-2 py-0.5">{product.siteName}</span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2 flex-1">
            {product.title}
          </h3>

          {/* Price row */}
          <div className="flex items-end justify-between mt-auto pt-2 border-t border-[var(--border)]">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">Current Price</p>
              <p className="text-xl font-bold text-white">
                {formatPrice(product.currentPrice)}
              </p>
            </div>

            {/* Show diff if price dropped */}
            {priceDropped && (
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)] mb-0.5">Was</p>
                <p className="text-sm text-[var(--text-muted)] line-through">
                  {formatPrice(firstPrice)}
                </p>
                <p className="text-xs text-[var(--green)] font-semibold">
                  ↓ {Math.round(((firstPrice - product.currentPrice) / firstPrice) * 100)}% off
                </p>
              </div>
            )}
          </div>

          {/* Chart hint */}
          <p className="text-xs text-[var(--text-muted)] text-center mt-1">
            Click to view price history →
          </p>
        </div>
      </article>

      {/* ── Price chart modal ──────────────────────────────────────────── */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className="glass-modal w-full max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: siteColour }}
                  />
                  <span className="badge-site px-2 py-0.5">{product.siteName}</span>
                  {priceDropped && (
                    <span className="badge-drop px-2 py-0.5">📉 Price Dropped</span>
                  )}
                </div>
                <h2 className="text-base font-semibold text-white leading-snug line-clamp-2">
                  {product.title}
                </h2>
              </div>
              <button
                id="close-modal-btn"
                onClick={() => setExpanded(false)}
                className="flex-shrink-0 w-8 h-8 rounded-full border border-[var(--border)] flex items-center
                           justify-center text-[var(--text-muted)] hover:text-white hover:border-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Current price */}
            <p className="text-3xl font-bold text-white mb-1">
              {formatPrice(product.currentPrice)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-5">
              Last updated: {new Date(product.updatedAt).toLocaleString('en-IN')}
            </p>

            {/* Chart */}
            <PriceChart product={product} />

            {/* External link */}
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              id="view-product-btn"
              className="btn-primary mt-5 w-full py-2.5 text-sm flex items-center justify-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              View on {product.siteName}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
