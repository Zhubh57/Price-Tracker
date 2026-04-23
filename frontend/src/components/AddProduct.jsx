import { useState } from 'react';
import { addProduct as addProductApi } from '../services/api';
import toast from 'react-hot-toast';

/**
 * AddProduct
 * URL input form that triggers the scrape + save flow.
 * Displays a loading spinner inline and fires toast notifications.
 *
 * @param {{ onProductAdded: (product: object) => void }} props
 */
export default function AddProduct({ onProductAdded }) {
  const [url, setUrl]         = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return toast.error('Please enter a product URL.');

    setLoading(true);
    const toastId = toast.loading('Scraping product… this may take a moment ⏳', { duration: Infinity });

    try {
      const product = await addProductApi(url.trim());
      toast.dismiss(toastId);
      toast.success(`✅ "${product.title?.slice(0, 40)}…" added!`, { duration: 4000 });
      setUrl('');
      onProductAdded?.(product);
    } catch (err) {
      toast.dismiss(toastId);
      const msg = err?.response?.data?.message || 'Failed to scrape product. Try again.';
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* URL Input */}
        <div className="relative flex-1">
          {/* Search icon */}
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <input
            id="product-url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Amazon or Flipkart product URL…"
            disabled={loading}
            className="input-field w-full pl-10 pr-4 py-3 text-sm"
            autoComplete="off"
          />
        </div>

        {/* Submit button */}
        <button
          id="track-product-btn"
          type="submit"
          disabled={loading || !url.trim()}
          className="btn-primary px-6 py-3 text-sm whitespace-nowrap flex items-center gap-2"
        >
          {loading ? (
            <>
              {/* Spinner */}
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Tracking…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Track Price
            </>
          )}
        </button>
      </div>

      {/* Supported sites hint */}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Supports Amazon.in · Flipkart · Myntra · AJIO
      </p>
    </form>
  );
}
