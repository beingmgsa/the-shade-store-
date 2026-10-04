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

/**
 * Format raw firestore document to GlassesProduct
 */
export function normalizeProductDoc(id: string, data: any): GlassesProduct {
  let img = typeof data.image === 'string' && data.image.trim() ? data.image.trim() : '';
  if (!img && typeof data.imageUrl === 'string' && data.imageUrl.trim()) {
    img = data.imageUrl.trim();
  }

  // Handle images array
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

  return {
    id: id || data.id,
    name: data.name || 'Eyewear Frame',
    price: data.price !== undefined && data.price !== null && data.price !== '' ? Number(data.price) : null,
    image: img,
    images: gallery.length > 0 ? gallery : (img ? [img] : []),
    itemCode: data.itemCode || undefined,
    description: data.description || '',
    available: data.available !== false,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetch all products from Firestore as the single permanent source of truth
 */
export async function getProductsWithFallback(): Promise<{
  products: GlassesProduct[];
  source: 'firestore' | 'api' | 'empty';
  firebaseStatus: FirebaseSyncStatus;
}> {
  // 1. Try Firestore direct read (primary and permanent store)
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    const items: GlassesProduct[] = [];
    snapshot.forEach((docSnap) => {
      items.push(normalizeProductDoc(docSnap.id, docSnap.data()));
    });

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      products: items,
      source: 'firestore',
      firebaseStatus: { status: 'connected' },
    };
  } catch (err: any) {
    console.warn('Firestore fetch products notice:', err);
    const msg = err?.message || String(err);
    const isDisabled = msg.includes('has not been used in project') || 
                       msg.includes('disabled') || 
                       msg.includes('permission-denied') ||
                       err?.code === 'permission-denied';

    const status: FirebaseSyncStatus = {
      status: isDisabled ? 'disabled' : 'error',
      errorDetails: msg,
      enableUrl: FIRESTORE_ENABLE_URL,
    };

    // 2. Try server API /api/products as serverless proxy fallback (which also reads saved products)
    try {
      const res = await fetch(`/api/products?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return {
            products: data.map((d: any) => normalizeProductDoc(d.id, d)),
            source: 'api',
            firebaseStatus: status,
          };
        }
      }
    } catch {
      // Fall through to empty
    }

    // Never restore hardcoded fake samples; return empty array with error status
    return {
      products: [],
      source: 'empty',
      firebaseStatus: status,
    };
  }
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

  const docData: any = {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image, // Uniform primary image
    images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image],
    itemCode: product.itemCode || '',
    description: product.description || '',
    available: product.available !== false,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  // Helper with 10s timeout so network hangs never freeze the publisher
  const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
    ]);
  };

  // 1. Write to Firestore directly via Firebase Web SDK
  try {
    const docRef = doc(db, 'products', product.id);
    await withTimeout(
      setDoc(docRef, docData, { merge: true }),
      8000,
      'Firestore write timed out after 8s'
    );
    firestoreSuccess = true;
  } catch (err: any) {
    console.warn('Firestore direct write notice:', err);
    firestoreError = err?.message || String(err);
  }

  // 2. Also sync to backend API as fallback cache (non-blocking)
  if (authToken) {
    try {
      const apiPromise = fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(docData),
      });

      // Give API 5 seconds max, do not wait forever
      const res = await withTimeout(apiPromise, 5000, 'API sync timed out');
      if (res.ok) {
        // If Firestore had a network timeout but API succeeded, consider saved!
        if (!firestoreSuccess) {
          firestoreSuccess = true;
          firestoreError = undefined;
        }
      }
    } catch (apiErr) {
      console.warn('Backend API sync notice:', apiErr);
    }
  }

  return { firestoreSuccess, firestoreError };
}

/**
 * Delete a product document in Firebase Firestore AND sync with backend
 */
export async function deleteProductFromFirebase(productId: string, authToken?: string): Promise<{
  firestoreSuccess: boolean;
  firestoreError?: string;
  apiSuccess?: boolean;
  apiError?: string;
}> {
  let firestoreSuccess = false;
  let firestoreError: string | undefined;
  let apiSuccess = false;
  let apiError: string | undefined;

  // 1. Delete from Firestore database
  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
    firestoreSuccess = true;
  } catch (err: any) {
    console.warn('Firestore direct delete error:', err);
    firestoreError = err?.message || String(err);
  }

  // 2. Delete from Backend API cache
  try {
    if (authToken) {
      const res = await fetch(`/api/admin/products?id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        apiSuccess = true;
      } else {
        // Fallback to route param /api/admin/products/:id
        const fallbackRes = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (fallbackRes.ok) {
          apiSuccess = true;
        } else {
          const errData = await fallbackRes.json().catch(() => null);
          apiError = errData?.error || `API delete failed with status ${fallbackRes.status}`;
        }
      }
    }
  } catch (apiErr: any) {
    console.warn('Backend API sync delete error:', apiErr);
    apiError = apiErr?.message || 'Network error deleting from backend API';
  }

  return { firestoreSuccess, firestoreError, apiSuccess, apiError };
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
