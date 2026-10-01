import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractBearerToken, verifyFirebaseOwnerToken } from '../_lib/auth.js';
import { getProducts, saveProducts, normalizeProductImage, GlassesProduct } from '../_lib/products.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

  const products = getProducts();

  // POST: Add new frame or upsert
  if (req.method === 'POST') {
    const { id: incomingId, name, price, image, itemCode, description, available } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    // Check if product with this ID already exists -> update it
    if (incomingId && typeof incomingId === 'string') {
      const existingIdx = products.findIndex((p) => p.id === incomingId);
      if (existingIdx !== -1) {
        const cur = products[existingIdx];
        const updated: GlassesProduct = {
          ...cur,
          name: name.trim(),
          price: price !== undefined ? (price === null || price === '' ? null : Number(price)) : cur.price,
          image: normalizeProductImage(image) || cur.image,
          itemCode: itemCode && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : cur.itemCode,
          description: description && typeof description === 'string' ? description.trim() : cur.description,
          available: available !== undefined ? Boolean(available) : cur.available,
          updatedAt: new Date().toISOString(),
        };
        products[existingIdx] = updated;
        saveProducts(products);
        return res.status(200).json(updated);
      }
    }

    const id = incomingId && typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim()
      : `frame-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newProduct: GlassesProduct = {
      id,
      name: name.trim(),
      price: price !== undefined && price !== null && price !== '' ? Number(price) : null,
      image: normalizeProductImage(image),
      itemCode: itemCode && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : `TSS-${String(products.length + 1).padStart(2, '0')}`,
      description: description && typeof description === 'string' ? description.trim() : '',
      available: available !== undefined ? Boolean(available) : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    products.unshift(newProduct);
    saveProducts(products);
    return res.status(201).json(newProduct);
  }

  // PUT: Update frame if id passed in body or query
  if (req.method === 'PUT') {
    const id = (req.query?.id as string) || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing product ID to update' });
    }

    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const current = products[index];
    const { name, price, image, itemCode, description, available } = req.body || {};

    const newImage = image !== undefined && typeof image === 'string' && image.trim()
      ? normalizeProductImage(image.trim())
      : current.image;

    const updated: GlassesProduct = {
      ...current,
      name: name !== undefined && typeof name === 'string' && name.trim() ? name.trim() : current.name,
      price: price !== undefined ? (price === null || price === '' ? null : Number(price)) : current.price,
      image: newImage,
      itemCode: itemCode !== undefined && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : current.itemCode,
      description: description !== undefined && typeof description === 'string' ? description.trim() : current.description,
      available: available !== undefined ? Boolean(available) : current.available,
      updatedAt: new Date().toISOString(),
    };

    products[index] = updated;
    saveProducts(products);
    return res.status(200).json(updated);
  }

  // DELETE: Delete frame if id passed in body or query
  if (req.method === 'DELETE') {
    const id = (req.query?.id as string) || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing product ID to delete' });
    }

    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const deleted = products.splice(index, 1)[0];
    saveProducts(products);
    return res.status(200).json({ message: 'Product deleted permanently', deleted });
  }

  return res.status(405).json({ error: `Method ${req.method} not supported on this endpoint` });
}
