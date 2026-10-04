import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractBearerToken, verifyFirebaseOwnerToken } from '../../_lib/auth.js';
import { getProducts, saveProducts, normalizeProductImage, GlassesProduct } from '../../_lib/products.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  // Auth check
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Firebase authentication token required' });
  }

  const authResult = verifyFirebaseOwnerToken(token);
  if (!authResult.valid) {
    return res.status(403).json({ error: authResult.error || 'Forbidden: Admin access denied' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Missing product ID' });
  }

  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (req.method === 'PUT') {
    const current = products[index];
    const { name, price, image, images, itemCode, description, available } = req.body || {};

    const newImage = image !== undefined && typeof image === 'string' && image.trim()
      ? normalizeProductImage(image.trim())
      : current.image;

    const normalizedImages: string[] = Array.isArray(images) && images.length > 0
      ? images.map((u: any) => normalizeProductImage(String(u)))
      : (newImage ? [newImage] : current.images || []);

    const updated: GlassesProduct = {
      ...current,
      name: name !== undefined && typeof name === 'string' && name.trim() ? name.trim() : current.name,
      price: price !== undefined ? (price === null || price === '' ? null : Number(price)) : current.price,
      image: newImage,
      images: normalizedImages,
      itemCode: itemCode !== undefined && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : current.itemCode,
      description: description !== undefined && typeof description === 'string' ? description.trim() : current.description,
      available: available !== undefined ? Boolean(available) : current.available,
      updatedAt: new Date().toISOString(),
    };

    products[index] = updated;
    saveProducts(products);
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const deleted = products.splice(index, 1)[0];
    saveProducts(products);
    return res.status(200).json({ message: 'Product deleted permanently', deleted });
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
