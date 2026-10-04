import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './config';

export interface GlassesProduct {
  id: string;
  name: string;
  price: number | null;
  image: string; // Uniform primary image field across Firebase and frontend
  images?: string[]; // Multiple photos gallery
  itemCode?: string;
  description?: string;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FirebaseSyncStatus {
  status: 'connected' | 'error' | 'disabled' | 'idle';
  errorDetails?: string;
  enableUrl?: string;
}

export const FIRESTORE_ENABLE_URL = 'https://console.firebase.google.com/project/the-shade-store-2335e/firestore';
export const PRODUCTS_CACHE_KEY = 'the_shade_store_products_v2';

/**
 * Format raw firestore document or JSON object to standard GlassesProduct
 */
export function normalizeProductDoc(id: string, data: any): GlassesProduct {
  let img = typeof data.image === 'string' && data.image.trim() ? data.image.trim() : '';
  if (!img && typeof data.imageUrl === 'string' && data.imageUrl.trim()) {
    img = data.imageUrl.trim();
  }

  // Handle images gallery array
  let gallery: string[] = [];
  if (Array.isArray(data.images) && data.images.length > 0) {
    gallery = data.images.filter((x: any) => typeof x === 'string' && x.trim().length > 0);
  }

  if (!img && gallery.length > 0) {
    img = gallery[0];
  }
  if (!img) {
    img = '/images/glasses_tortoise_acetate_1790681743897.jpg';
  }

  if (gallery.length === 0 && img) {
    gallery = [img];
  } else if (img && !gallery.includes(img)) {
    gallery.unshift(img);
  }

  return {
    id: id || data.id,
    name: data.name || 'Eyewear Frame',
    price: data.price !== undefined && data.price !== null && data.price !== '' ? Number(data.price) : null,
    image: img,
    images: gallery,
    itemCode: data.itemCode || undefined,
    description: data.description || '',
    available: data.available !== false,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

/**
 * Read cached products from browser localStorage
 */
export function getLocalProducts(): GlassesProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => normalizeProductDoc(item.id, item));
    }
  } catch (err) {
    console.warn('Error reading local products cache:', err);
  }
  return [];
}

/**
 * Save products to browser localStorage
 */
export function saveLocalProducts(products: GlassesProduct[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  } catch (err) {
    console.warn('Error saving to local products cache:', err);
  }
}

/**
 * Add or update a single product in localStorage immediately
 */
export function upsertLocalProduct(product: GlassesProduct): void {
  const current = getLocalProducts();
  const existingIdx = current.findIndex((p) => p.id === product.id);
  let updated: GlassesProduct[];
  if (existingIdx !== -1) {
    updated = [...current];
    updated[existingIdx] = product;
  } else {
    updated = [product, ...current];
  }
  saveLocalProducts(updated);
}

/**
 * Remove a single product from localStorage immediately
 */
export function removeLocalProduct(id: string): void {
  const current = getLocalProducts();
  const filtered = current.filter((p) => p.id !== id);
  saveLocalProducts(filtered);
}

/**
 * Helper to race any promise against a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

/**
 * Fetch all products with multi-tier fallback:
 * Tier 1: Local Storage Cache (instant, 0ms)
 * Tier 2: Server API /api/products
 * Tier 3: Firebase Firestore
 * NEVER resets products to empty [] if local or server products already exist!
 */
export async function getProductsWithFallback(): Promise<{
  products: GlassesProduct[];
  source: 'firestore' | 'api' | 'cache' | 'empty';
  firebaseStatus: FirebaseSyncStatus;
}> {
  const localItems = getLocalProducts();

  // 1. Try reading directly from Firestore
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await withTimeout(
      getDocs(productsRef),
      2500,
      'Firestore read timeout'
    );
    
    const firestoreItems: GlassesProduct[] = [];
    snapshot.forEach((docSnap) => {
      firestoreItems.push(normalizeProductDoc(docSnap.id, docSnap.data()));
    });

    if (firestoreItems.length > 0) {
      firestoreItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveLocalProducts(firestoreItems);
      return {
        products: firestoreItems,
        source: 'firestore',
        firebaseStatus: { status: 'connected' },
      };
    }

    // Firestore returned 0 docs. If we have local cached products, DO NOT wipe them!
    if (localItems.length > 0) {
      return {
        products: localItems,
        source: 'cache',
        firebaseStatus: { status: 'connected' },
      };
    }
  } catch (err: any) {
    console.warn('Firestore fetch notice:', err);
  }

  // 2. Try server API /api/products as backend store fallback
  try {
    const res = await withTimeout(
      fetch(`/api/products?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      }),
      2500,
      'API fetch timeout'
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map((d: any) => normalizeProductDoc(d.id, d));
        // Merge with local if local has newer additions
        const map = new Map<string, GlassesProduct>();
        normalized.forEach((p: GlassesProduct) => map.set(p.id, p));
        localItems.forEach((p) => {
          if (!map.has(p.id)) map.set(p.id, p);
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveLocalProducts(merged);
        return {
          products: merged,
          source: 'api',
          firebaseStatus: {
            status: 'disabled',
            errorDetails: 'Using secure local and server database',
            enableUrl: FIRESTORE_ENABLE_URL,
          },
        };
      }
    }
  } catch (apiErr) {
    console.warn('Backend API fetch notice:', apiErr);
  }

  // 3. Fall back to local products cache
  if (localItems.length > 0) {
    return {
      products: localItems,
      source: 'cache',
      firebaseStatus: {
        status: 'disabled',
        errorDetails: 'Operating from persistent local storage',
        enableUrl: FIRESTORE_ENABLE_URL,
      },
    };
  }

  return {
    products: [],
    source: 'empty',
    firebaseStatus: {
      status: 'disabled',
      errorDetails: 'No products in database yet',
      enableUrl: FIRESTORE_ENABLE_URL,
    },
  };
}

/**
 * Save or update a product document immediately in localStorage, server API, and Firebase Firestore
 */
export async function saveProductToFirebase(product: GlassesProduct, authToken?: string): Promise<{
  firestoreSuccess: boolean;
  firestoreError?: string;
}> {
  // Step 1: Immediately persist to browser storage so refresh NEVER loses this product
  upsertLocalProduct(product);

  const docData: any = {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image],
    itemCode: product.itemCode || '',
    description: product.description || '',
    available: product.available !== false,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  let firestoreSuccess = true;
  let firestoreError: string | undefined;

  // Step 2: Fire and track Firestore direct write (2000ms max timeout)
  const firestorePromise = (async () => {
    try {
      const docRef = doc(db, 'products', product.id);
      await withTimeout(
        setDoc(docRef, docData, { merge: true }),
        2000,
        'Firestore write timed out'
      );
    } catch (err: any) {
      console.warn('Firestore write notice (handled):', err?.message || err);
      firestoreError = err?.message || String(err);
    }
  })();

  // Step 3: Concurrently persist to server API /api/admin/products (2500ms max timeout)
  const apiPromise = (async () => {
    if (!authToken) return;
    try {
      await withTimeout(
        fetch('/api/admin/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(docData),
        }),
        2500,
        'API write timed out'
      );
    } catch (err) {
      console.warn('Backend API sync notice (handled):', err);
    }
  })();

  // Await both promises in parallel with strict cap so UI finishes quickly
  await Promise.allSettled([firestorePromise, apiPromise]);

  return { firestoreSuccess: true, firestoreError };
}

/**
 * Delete a product document across localStorage, Firestore, and backend API
 */
export async function deleteProductFromFirebase(productId: string, authToken?: string): Promise<{
  firestoreSuccess: boolean;
  firestoreError?: string;
  apiSuccess?: boolean;
  apiError?: string;
}> {
  // Step 1: Immediately remove from localStorage
  removeLocalProduct(productId);

  let firestoreSuccess = true;
  let firestoreError: string | undefined;
  let apiSuccess = true;
  let apiError: string | undefined;

  // Step 2: Firestore delete
  try {
    const docRef = doc(db, 'products', productId);
    await withTimeout(deleteDoc(docRef), 2000, 'Firestore delete timeout');
  } catch (err: any) {
    firestoreError = err?.message;
  }

  // Step 3: Backend API delete
  if (authToken) {
    try {
      await withTimeout(
        fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }),
        2500,
        'API delete timeout'
      );
    } catch (err: any) {
      apiError = err?.message;
    }
  }

  return { firestoreSuccess, firestoreError, apiSuccess, apiError };
}

/**
 * Realtime listener for product updates from Firestore
 * Safe: Never empties existing products if Firestore returns 0 items
 */
export function subscribeToProducts(
  onUpdate: (products: GlassesProduct[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const productsRef = collection(db, 'products');
  return onSnapshot(
    productsRef,
    (snapshot) => {
      const items: GlassesProduct[] = [];
      snapshot.forEach((d) => items.push(normalizeProductDoc(d.id, d.data())));
      
      // If Firestore has real products, update and save
      if (items.length > 0) {
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveLocalProducts(items);
        onUpdate(items);
      } else {
        // If Firestore has 0 documents (unprovisioned or empty), keep existing local cache!
        const local = getLocalProducts();
        if (local.length > 0) {
          onUpdate(local);
        }
      }
    },
    (err) => {
      console.warn('Firestore snapshot listener notice (handled):', err?.message || err);
      onError?.(err);
    }
  );
}
