import axios from 'axios';

// Axios instance — base URL is empty so the Vite proxy handles routing in dev.
// In production, set VITE_API_URL as an env variable.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 60000,        // 60 s — scraping can take a while
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Products API
// ---------------------------------------------------------------------------

/**
 * GET /api/products
 * Fetch all tracked products (newest first).
 * @returns {Promise<Array>} Array of product documents
 */
export const getProducts = async () => {
  const { data } = await api.get('/api/products');
  return data.data;       // { success, message, data: [...] }
};

/**
 * POST /api/products
 * Add and scrape a new product by URL.
 * @param {string} url  Product URL (Amazon, Flipkart, Myntra, AJIO)
 * @returns {Promise<Object>} Saved product document
 */
export const addProduct = async (url) => {
  const { data } = await api.post('/api/products', { url });
  return data.data;
};

/**
 * DELETE /api/products/:id
 * Remove a product from tracking.
 * @param {string} id MongoDB ObjectId
 */
export const deleteProduct = async (id) => {
  const { data } = await api.delete(`/api/products/${id}`);
  return data;
};

export default api;
