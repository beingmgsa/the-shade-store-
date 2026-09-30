import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  return res.status(200).json({
    name: 'The Shade Store API',
    status: 'online',
    endpoints: [
      '/api/products',
      '/api/admin/status',
      '/api/admin/me',
      '/api/admin/cloudinary-status',
      '/api/admin/cloudinary-sign',
      '/api/admin/products',
    ],
  });
}
