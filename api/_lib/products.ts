import fs from 'fs';
import path from 'path';

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

export const DEFAULT_PRODUCTS: GlassesProduct[] = [
  {
    id: "frame-01",
    name: "Classic Amber Tortoise Frame",
    price: 1899,
    image: "/images/glasses_tortoise_acetate_1790681743897.jpg",
    itemCode: "TSS-01",
    description: "Premium handcrafted tortoise shell acetate frame with smooth spring hinges and comfortable nose pads.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-02",
    name: "Matte Black Sculpted Square",
    price: 1699,
    image: "/images/glasses_matte_black_square_1790681762010.jpg",
    itemCode: "TSS-02",
    description: "Modern architectural square silhouette with velvety matte black finish. Ultra-durable daily driver.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-03",
    name: "Brushed Gold Geometric Hexagonal",
    price: 2199,
    image: "/images/glasses_gold_geometric_1790681777666.jpg",
    itemCode: "TSS-03",
    description: "Distinctive geometric hexagonal rims crafted from lightweight brushed gold alloy with clear acetate tips.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-04",
    name: "Minimalist Titanium Round Wire",
    price: 2499,
    image: "/images/glasses_minimalist_titanium_1790681791906.jpg",
    itemCode: "TSS-04",
    description: "Featherlight titanium round wire frame with hypoallergenic silicone nose pads and flexible temples.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-05",
    name: "Vintage Havana Rounded Acetate",
    price: 1999,
    image: "/images/glasses_tortoise_acetate_1790681743897.jpg",
    itemCode: "TSS-05",
    description: "Timeless Havana brown optical frame with retro keyhole bridge and polished dual-rivet accents.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-06",
    name: "Modern Architectural Black Optical",
    price: 1599,
    image: "/images/glasses_matte_black_square_1790681762010.jpg",
    itemCode: "TSS-06",
    description: "Sleek low-profile black rectangular frame suitable for single-vision and progressive optical lenses.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-07",
    name: "Fine Wire Gold Octagonal Frame",
    price: 2299,
    image: "/images/glasses_gold_geometric_1790681777666.jpg",
    itemCode: "TSS-07",
    description: "Delicate polished gold octagonal wire frame offering a sharp, intellectual profile for everyday wear.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
  {
    id: "frame-08",
    name: "Polished Silver Lightweight Round",
    price: 2399,
    image: "/images/glasses_minimalist_titanium_1790681791906.jpg",
    itemCode: "TSS-08",
    description: "Contemporary polished silver round optical frame engineered for supreme comfort and all-day wear.",
    available: true,
    createdAt: "2026-09-30T06:08:13.446Z",
    updatedAt: "2026-09-30T06:08:13.446Z",
  },
];

export function normalizeProductImage(image?: string | null): string {
  if (!image || typeof image !== 'string') {
    return '/images/glasses_tortoise_acetate_1790681743897.jpg';
  }
  const trimmed = image.trim();
  if (trimmed.startsWith('/src/assets/images/')) {
    return trimmed.replace('/src/assets/images/', '/images/');
  }
  return trimmed;
}

// In-memory cache for serverless invocation lifecycle
let memoryProducts: GlassesProduct[] | null = null;

const DATA_FILE = path.resolve(process.cwd(), 'data', 'products.json');
const TMP_FILE = path.resolve('/tmp', 'the_shade_store_products.json');

export function getProducts(): GlassesProduct[] {
  if (memoryProducts && memoryProducts.length > 0) {
    return memoryProducts;
  }

  // 1. Try /tmp in serverless
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryProducts = parsed;
        return parsed;
      }
    }
  } catch {
    // Continue
  }

  // 2. Try repo data/products.json
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryProducts = parsed.map((item) => ({
          ...item,
          image: normalizeProductImage(item.image),
        }));
        return memoryProducts;
      }
    }
  } catch {
    // Continue
  }

  memoryProducts = [...DEFAULT_PRODUCTS];
  return memoryProducts;
}

export function saveProducts(products: GlassesProduct[]): void {
  memoryProducts = [...products];

  // Try saving to project root data/products.json
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch {
    // In serverless environments (like Vercel AWS Lambda), the deployment root is read-only.
    // Try saving to /tmp directory which is always writable
    try {
      fs.writeFileSync(TMP_FILE, JSON.stringify(products, null, 2), 'utf-8');
    } catch (tmpErr) {
      console.warn('Could not write products to /tmp, keeping in memory:', tmpErr);
    }
  }
}
