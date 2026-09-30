import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const OWNER_EMAIL = (process.env.ADMIN_OWNER_EMAIL || 'beingmagrajwork@gmail.com').toLowerCase().trim();
const FIREBASE_PROJECT_ID = 'the-shade-store-2335e';

// Cloudinary Configuration (Stored strictly on the server, never sent to browser)
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim();
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim();

function isCloudinaryConfigured(): boolean {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

function generateCloudinarySignature(paramsToSign: Record<string, string | number>, apiSecret: string): string {
  const sortedKeys = Object.keys(paramsToSign).sort();
  const serialized = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join('&');
  return crypto.createHash('sha1').update(serialized + apiSecret).digest('hex');
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

// Initial default products
const DEFAULT_PRODUCTS: GlassesProduct[] = [
  {
    id: "frame-01",
    name: "Classic Amber Tortoise Frame",
    price: 1899,
    image: "/src/assets/images/glasses_tortoise_acetate_1790681743897.jpg",
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
    image: "/src/assets/images/glasses_matte_black_square_1790681762010.jpg",
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
    image: "/src/assets/images/glasses_gold_geometric_1790681777666.jpg",
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
    image: "/src/assets/images/glasses_minimalist_titanium_1790681791906.jpg",
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
    image: "/src/assets/images/glasses_tortoise_acetate_1790681743897.jpg",
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
    image: "/src/assets/images/glasses_matte_black_square_1790681762010.jpg",
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
    image: "/src/assets/images/glasses_gold_geometric_1790681777666.jpg",
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
    image: "/src/assets/images/glasses_minimalist_titanium_1790681791906.jpg",
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
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading products file, returning default:', err);
    return DEFAULT_PRODUCTS;
  }
}

function saveProducts(products: GlassesProduct[]): void {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
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
  const products = getProducts();
  res.json(products);
});

// 2. Admin status endpoint
app.get('/api/admin/status', (_req: Request, res: Response) => {
  res.json({
    authMethod: 'firebase',
    ownerEmail: OWNER_EMAIL,
    projectId: FIREBASE_PROJECT_ID,
  });
});

// 3. Admin session check endpoint (verifies token with server)
app.get('/api/admin/me', requireOwnerAuth, (req: Request, res: Response) => {
  const email = (req as unknown as { ownerEmail: string }).ownerEmail;
  res.json({
    authenticated: true,
    email,
    ownerEmail: OWNER_EMAIL,
  });
});

// 4. Cloudinary configuration status (Owner only, never exposes API secret)
app.get('/api/admin/cloudinary-status', requireOwnerAuth, (_req: Request, res: Response) => {
  res.json({
    configured: isCloudinaryConfigured(),
    cloudName: CLOUDINARY_CLOUD_NAME || null,
    apiKey: CLOUDINARY_API_KEY || null,
    // API secret is strictly kept hidden on server
  });
});

// 5. Cloudinary signed upload signature generator (Owner only)
app.post('/api/admin/cloudinary-sign', requireOwnerAuth, (_req: Request, res: Response) => {
  if (!isCloudinaryConfigured()) {
    res.status(400).json({
      error: 'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured. Please add them to your environment secrets.',
      missing: {
        cloudName: !CLOUDINARY_CLOUD_NAME,
        apiKey: !CLOUDINARY_API_KEY,
        apiSecret: !CLOUDINARY_API_SECRET,
      },
    });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'the_shade_store/products';

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  };

  const signature = generateCloudinarySignature(paramsToSign, CLOUDINARY_API_SECRET!);

  res.json({
    signature,
    timestamp,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
    folder,
  });
});

// 4. Admin Products: Add
app.post('/api/admin/products', requireOwnerAuth, (req: Request, res: Response) => {
  const { name, price, image, itemCode, description, available } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Product name is required.' });
    return;
  }

  const products = getProducts();
  const id = `frame-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newProduct: GlassesProduct = {
    id,
    name: name.trim(),
    price: price !== undefined && price !== null && price !== '' ? Number(price) : null,
    image: image && typeof image === 'string' && image.trim() ? image.trim() : '/src/assets/images/glasses_tortoise_acetate_1790681743897.jpg',
    itemCode: itemCode && typeof itemCode === 'string' ? itemCode.trim() : `TSS-${String(products.length + 1).padStart(2, '0')}`,
    description: description && typeof description === 'string' ? description.trim() : '',
    available: available !== undefined ? Boolean(available) : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  products.unshift(newProduct);
  saveProducts(products);

  res.status(201).json(newProduct);
});

// 5. Admin Products: Update
app.put('/api/admin/products/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, image, itemCode, description, available } = req.body;

  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const current = products[index];
  const updated: GlassesProduct = {
    ...current,
    name: name !== undefined ? String(name).trim() : current.name,
    price: price !== undefined ? (price === null || price === '' ? null : Number(price)) : current.price,
    image: image !== undefined && String(image).trim() ? String(image).trim() : current.image,
    itemCode: itemCode !== undefined ? String(itemCode).trim() : current.itemCode,
    description: description !== undefined ? String(description).trim() : current.description,
    available: available !== undefined ? Boolean(available) : current.available,
    updatedAt: new Date().toISOString(),
  };

  products[index] = updated;
  saveProducts(products);

  res.json(updated);
});

// 6. Admin Products: Delete
app.delete('/api/admin/products/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const deleted = products.splice(index, 1)[0];
  saveProducts(products);

  res.json({ message: 'Product deleted permanently', deleted });
});

// 7. Admin Products: Reset to defaults
app.post('/api/admin/products/reset', requireOwnerAuth, (_req: Request, res: Response) => {
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
