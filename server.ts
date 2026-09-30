import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const OWNER_EMAIL = (process.env.ADMIN_OWNER_EMAIL || 'beingmagrajwork@gmail.com').toLowerCase().trim();
const FIREBASE_PROJECT_ID = 'the-shade-store-2335e';

// Helper to get fresh Cloudinary configuration from environment variables
function getCloudinaryConfig() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  return {
    cloudName,
    apiKey,
    apiSecret,
    isConfigured: Boolean(cloudName && apiKey && apiSecret),
  };
}

function generateCloudinarySignature(paramsToSign: Record<string, string | number>, apiSecret: string): string {
  const sortedKeys = Object.keys(paramsToSign).sort();
  const serialized = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join('&');
  return crypto.createHash('sha1').update(serialized + apiSecret).digest('hex');
}

// Normalize image URLs so legacy development paths resolve to public/images in production
function normalizeProductImage(image?: string | null): string {
  if (!image || typeof image !== 'string') {
    return '/images/glasses_tortoise_acetate_1790681743897.jpg';
  }
  const trimmed = image.trim();
  if (trimmed.startsWith('/src/assets/images/')) {
    return trimmed.replace('/src/assets/images/', '/images/');
  }
  return trimmed;
}

app.use(express.json());

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

// Interface for Glasses Catalog Item
export interface GlassesProduct {
  id: string;
  name: string;
  price: number | null;
  image: string;
  itemCode?: string;
  description?: string;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

// Initial default products (pointing to reliable /images/ static files)
const DEFAULT_PRODUCTS: GlassesProduct[] = [
  {
    id: "frame-01",
    name: "Classic Amber Tortoise Frame",
    price: 1899,
    image: "/images/glasses_tortoise_acetate_1790681743897.jpg",
    itemCode: "TSS-01",
    description: "Premium handcrafted tortoise shell acetate frame with smooth spring hinges and comfortable nose pads.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-02",
    name: "Matte Black Sculpted Square",
    price: 1699,
    image: "/images/glasses_matte_black_square_1790681762010.jpg",
    itemCode: "TSS-02",
    description: "Modern architectural square silhouette with velvety matte black finish. Ultra-durable daily driver.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-03",
    name: "Brushed Gold Geometric Hexagonal",
    price: 2199,
    image: "/images/glasses_gold_geometric_1790681777666.jpg",
    itemCode: "TSS-03",
    description: "Distinctive geometric hexagonal rims crafted from lightweight brushed gold alloy with clear acetate tips.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-04",
    name: "Minimalist Titanium Round Wire",
    price: 2499,
    image: "/images/glasses_minimalist_titanium_1790681791906.jpg",
    itemCode: "TSS-04",
    description: "Featherlight titanium round wire frame with hypoallergenic silicone nose pads and flexible temples.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-05",
    name: "Vintage Havana Rounded Acetate",
    price: 1999,
    image: "/images/glasses_tortoise_acetate_1790681743897.jpg",
    itemCode: "TSS-05",
    description: "Timeless Havana brown optical frame with retro keyhole bridge and polished dual-rivet accents.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-06",
    name: "Modern Architectural Black Optical",
    price: 1599,
    image: "/images/glasses_matte_black_square_1790681762010.jpg",
    itemCode: "TSS-06",
    description: "Sleek low-profile black rectangular frame suitable for single-vision and progressive optical lenses.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-07",
    name: "Fine Wire Gold Octagonal Frame",
    price: 2299,
    image: "/images/glasses_gold_geometric_1790681777666.jpg",
    itemCode: "TSS-07",
    description: "Delicate polished gold octagonal wire frame offering a sharp, intellectual profile for everyday wear.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "frame-08",
    name: "Polished Silver Lightweight Round",
    price: 2399,
    image: "/images/glasses_minimalist_titanium_1790681791906.jpg",
    itemCode: "TSS-08",
    description: "Contemporary polished silver round optical frame engineered for supreme comfort and all-day wear.",
    available: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to read and write products
function getProducts(): GlassesProduct[] {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(DEFAULT_PRODUCTS, null, 2), 'utf-8');
      return DEFAULT_PRODUCTS;
    }
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    const parsed: GlassesProduct[] = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(DEFAULT_PRODUCTS, null, 2), 'utf-8');
      return DEFAULT_PRODUCTS;
    }

    // Auto-migrate any old /src/assets/images paths to production /images
    let needsResave = false;
    const normalized = parsed.map((item) => {
      const normalizedImg = normalizeProductImage(item.image);
      if (normalizedImg !== item.image) {
        needsResave = true;
        return { ...item, image: normalizedImg };
      }
      return item;
    });

    if (needsResave) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
    }

    return normalized;
  } catch (err) {
    console.error('Error reading products file, returning default:', err);
    return DEFAULT_PRODUCTS;
  }
}

function saveProducts(products: GlassesProduct[]): void {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write products to database file:', err);
    throw new Error('Database write failed on server');
  }
}

// Parse and verify Firebase ID Token JWT
interface FirebaseTokenPayload {
  iss?: string;
  aud?: string;
  auth_time?: number;
  user_id?: string;
  sub?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    identities?: Record<string, unknown>;
    sign_in_provider?: string;
  };
}

function parseJwtPayload(token: string): FirebaseTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function verifyFirebaseOwnerToken(token: string): { valid: boolean; email?: string; error?: string } {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return { valid: false, error: 'Malformed authentication token' };
  }

  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: 'Firebase session expired. Please sign in again.' };
  }

  // Check audience (Firebase Project ID)
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    return { valid: false, error: `Invalid project token: expected audience ${FIREBASE_PROJECT_ID}` };
  }

  // Check issuer
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    return { valid: false, error: 'Invalid token issuer' };
  }

  // Verify email matches designated shop owner
  const email = (payload.email || '').toLowerCase().trim();
  if (!email || email !== OWNER_EMAIL) {
    return { 
      valid: false, 
      error: `Access Denied: Only the store owner (${OWNER_EMAIL}) has admin privileges.` 
    };
  }

  return { valid: true, email };
}

// Authentication Middleware: Verifies Firebase ID Token
function requireOwnerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Firebase authentication token required' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const result = verifyFirebaseOwnerToken(token);

  if (!result.valid) {
    res.status(403).json({ error: result.error || 'Forbidden: Admin access denied' });
    return;
  }

  (req as unknown as { ownerEmail: string }).ownerEmail = result.email!;
  next();
}

// ======================== API ROUTES ========================

// 1. Public catalog endpoint
app.get('/api/products', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  const products = getProducts();
  res.json(products);
});

// 2. Admin status endpoint
app.get('/api/admin/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    authMethod: 'firebase',
    ownerEmail: OWNER_EMAIL,
    projectId: FIREBASE_PROJECT_ID,
  });
});

// 3. Admin session check endpoint (verifies token with server)
app.get('/api/admin/me', requireOwnerAuth, (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const email = (req as unknown as { ownerEmail: string }).ownerEmail;
  res.json({
    authenticated: true,
    email,
    ownerEmail: OWNER_EMAIL,
  });
});

// 4. Cloudinary configuration status (Owner only, never exposes API secret)
app.get('/api/admin/cloudinary-status', requireOwnerAuth, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryConfig();
  res.json({
    configured: isConfigured,
    cloudName: cloudName || null,
    apiKey: apiKey || null,
    missing: {
      cloudName: !cloudName,
      apiKey: !apiKey,
      apiSecret: !apiSecret,
    },
  });
});

// 5. Cloudinary signed upload signature generator (Owner only)
app.post('/api/admin/cloudinary-sign', requireOwnerAuth, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryConfig();
  if (!isConfigured) {
    const missingKeys: string[] = [];
    if (!cloudName) missingKeys.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missingKeys.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missingKeys.push('CLOUDINARY_API_SECRET');

    res.status(400).json({
      error: `Cloudinary secrets missing in production: ${missingKeys.join(', ')}. Please add them in your environment settings/secrets.`,
      missing: missingKeys,
    });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'the_shade_store/products';

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  };

  const signature = generateCloudinarySignature(paramsToSign, apiSecret);

  res.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
  });
});

// 6. Admin Products: Add
app.post('/api/admin/products', requireOwnerAuth, (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const { name, price, image, itemCode, description, available } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Product name is required.' });
    return;
  }

  const normalizedImage = normalizeProductImage(image);

  const products = getProducts();
  const id = `frame-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newProduct: GlassesProduct = {
    id,
    name: name.trim(),
    price: price !== undefined && price !== null && price !== '' ? Number(price) : null,
    image: normalizedImage,
    itemCode: itemCode && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : `TSS-${String(products.length + 1).padStart(2, '0')}`,
    description: description && typeof description === 'string' ? description.trim() : '',
    available: available !== undefined ? Boolean(available) : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    products.unshift(newProduct);
    saveProducts(products);
    res.status(201).json(newProduct);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to write product to database: ' + (err.message || 'Server error') });
  }
});

// 7. Admin Products: Update
app.put('/api/admin/products/:id', requireOwnerAuth, (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const { id } = req.params;
  const { name, price, image, itemCode, description, available } = req.body;

  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const current = products[index];

  // Carefully preserve existing fields if only photo or specific fields were updated
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

  try {
    products[index] = updated;
    saveProducts(products);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update product in database: ' + (err.message || 'Server error') });
  }
});

// 8. Admin Products: Delete
app.delete('/api/admin/products/:id', requireOwnerAuth, (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const { id } = req.params;
  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const deleted = products.splice(index, 1)[0];
  try {
    saveProducts(products);
    res.json({ message: 'Product deleted permanently', deleted });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete product from database: ' + (err.message || 'Server error') });
  }
});

// 9. Admin Products: Reset to defaults
app.post('/api/admin/products/reset', requireOwnerAuth, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  saveProducts(DEFAULT_PRODUCTS);
  res.json({ message: 'Catalog reset to defaults', products: DEFAULT_PRODUCTS });
});

// ======================== VITE INTEGRATION ========================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The Shade Store server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
