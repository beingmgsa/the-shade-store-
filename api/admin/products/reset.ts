import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractBearerToken, verifyFirebaseOwnerToken } from '../../_lib/auth.js';
import { DEFAULT_PRODUCTS, saveProducts } from '../../_lib/products.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Firebase authentication token required' });
  }

  const authResult = verifyFirebaseOwnerToken(token);
  if (!authResult.valid) {
    return res.status(403).json({ error: authResult.error || 'Forbidden: Admin access denied' });
  }

  saveProducts(DEFAULT_PRODUCTS);
  return res.status(200).json({ message: 'Catalog reset to defaults', products: DEFAULT_PRODUCTS });
}
