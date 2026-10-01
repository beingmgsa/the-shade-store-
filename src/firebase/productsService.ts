import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './config';
import { GLASSES_CATALOG } from '../data/glassesCatalog';

export interface GlassesProduct {
  id: string;
  name: string;
  price: number | null;
  image: string; // Uniform image field across Firebase and frontend
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

/**
 * Format raw firestore document to GlassesProduct
 */
export function normalizeProductDoc(id: string, data: any): GlassesProduct {
  let img = typeof data.image === 'string' && data.image.trim() ? data.image.trim() : '';
  if (!img && typeof data.imageUrl === 'string' && data.imageUrl.trim()) {
    img = data.imageUrl.trim();
  }
  if (!img) {
    img = '/images/glasses_tortoise_acetate_1790681743897.jpg';
  }

  return {
    id: id || data.id,
    name: data.name || 'Eyewear Frame',
    price: data.price !== undefined && data.price !== null && data.price !== '' ? Number(data.price) : null,
    image: img,
    itemCode: data.itemCode || undefined,
    description: data.description || '',
    available: data.available !== false,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetch all products from Firestore, with graceful fallback to /api/products and initial catalog
 */
export async function getProductsWithFallback(): Promise<{
  products: GlassesProduct[];
  source: 'firestore' | 'api' | 'static';
  firebaseStatus: FirebaseSyncStatus;
}> {
  // 1. Try Firestore direct read
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    if (!snapshot.empty) {
      const items: GlassesProduct[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeProductDoc(docSnap.id, docSnap.data()));
      });

      // Sort by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        products: items,
        source: 'firestore',
        firebaseStatus: { status: 'connected' },
      };
    }
  } catch (err: any) {
    console.warn('Firestore fetch products notice:', err);
    const msg = err?.message || String(err);
    const isDisabled = msg.includes('has not been used in project') || 
                       msg.includes('disabled') || 
                       msg.includes('permission-denied') ||
                       err?.code === 'permission-denied';

    // Continue to fallback, but record status
    const status: FirebaseSyncStatus = {
      status: isDisabled ? 'disabled' : 'error',
      errorDetails: msg,
      enableUrl: FIRESTORE_ENABLE_URL,
    };

    // Try /api/products fallback
    try {
      const res = await fetch(`/api/products?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return {
            products: data.map((d) => normalizeProductDoc(d.id, d)),
            source: 'api',
            firebaseStatus: status,
          };
        }
      }
    } catch {
      // Continue to static
    }

    return {
      products: GLASSES_CATALOG.map((g) => normalizeProductDoc(g.id, g)),
      source: 'static',
      firebaseStatus: status,
    };
  }

  // 2. If Firestore is empty, try API or seed
  try {
    const res = await fetch(`/api/products?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          products: data.map((d) => normalizeProductDoc(d.id, d)),
          source: 'api',
          firebaseStatus: { status: 'connected' },
        };
      }
    }
  } catch {
    // Continue
  }

  return {
    products: GLASSES_CATALOG.map((g) => normalizeProductDoc(g.id, g)),
    source: 'static',
    firebaseStatus: { status: 'connected' },
  };
}

/**
 * Save or update a product document in Firebase Firestore AND sync with backend
 */
export async function saveProductToFirebase(product: GlassesProduct, authToken?: string): Promise<{
  firestoreSuccess: boolean;
  firestoreError?: string;
}> {
  let firestoreSuccess = false;
  let firestoreError: string | undefined;

  // 1. Write to Firestore directly via Firebase Web SDK
  try {
    const docRef = doc(db, 'products', product.id);
    await setDoc(docRef, {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image, // Exact field name
      itemCode: product.itemCode || '',
      description: product.description || '',
      available: product.available !== false,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }, { merge: true });
    firestoreSuccess = true;
  } catch (err: any) {
    console.warn('Firestore direct write error:', err);
    firestoreError = err?.message || String(err);
  }

  // 2. Also sync to backend API as fallback cache
  try {
    if (authToken) {
      await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(product),
      });
    }
  } catch (apiErr) {
    console.warn('Backend API sync error:', apiErr);
  }

  return { firestoreSuccess, firestoreError };
}

/**
 * Delete a product document in Firebase Firestore AND sync with backend
 */
export async function deleteProductFromFirebase(productId: string, authToken?: string): Promise<{
  firestoreSuccess: boolean;
  firestoreError?: string;
}> {
  let firestoreSuccess = false;
  let firestoreError: string | undefined;

  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
    firestoreSuccess = true;
  } catch (err: any) {
    console.warn('Firestore direct delete error:', err);
    firestoreError = err?.message || String(err);
  }

  try {
    if (authToken) {
      // First try query parameter on /api/admin/products, then route param
      const res = await fetch(`/api/admin/products?id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
    }
  } catch (apiErr) {
    console.warn('Backend API sync delete error:', apiErr);
  }

  return { firestoreSuccess, firestoreError };
}

/**
 * Realtime listener for product updates from Firestore
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
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(items);
    },
    (err) => {
      console.warn('Firestore snapshot listener notice:', err);
      onError?.(err);
    }
  );
}
