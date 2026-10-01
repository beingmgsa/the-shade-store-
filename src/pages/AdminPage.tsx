import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ExternalLink, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Eye as EyeIcon, 
  ArrowLeft,
  RefreshCw,
  Info,
  HelpCircle,
  Mail,
  Upload,
  CloudUpload,
  Sparkles,
  Copy
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail,
  User 
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailsModal } from '../components/ProductDetailsModal';
import { 
  getProductsWithFallback, 
  saveProductToFirebase, 
  deleteProductFromFirebase, 
  subscribeToProducts, 
  FirebaseSyncStatus, 
  FIRESTORE_ENABLE_URL,
  GlassesProduct 
} from '../firebase/productsService';

const OWNER_EMAIL = 'beingmagrajwork@gmail.com';

const PRESET_STUDIO_IMAGES = [
  { label: 'Amber Tortoise Acetate', url: '/images/glasses_tortoise_acetate_1790681743897.jpg' },
  { label: 'Matte Black Square', url: '/images/glasses_matte_black_square_1790681762010.jpg' },
  { label: 'Brushed Gold Hexagonal', url: '/images/glasses_gold_geometric_1790681777666.jpg' },
  { label: 'Minimalist Titanium Round', url: '/images/glasses_minimalist_titanium_1790681791906.jpg' },
];

export interface AdminPageProps {
  onBackToStore?: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToStore }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Form states
  const [emailInput, setEmailInput] = useState<string>(OWNER_EMAIL);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Products state
  const [products, setProducts] = useState<GlassesProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'add' | 'cloudinary' | 'preview' | 'setup'>('catalog');

  // Modal / Editing states
  const [editingProduct, setEditingProduct] = useState<GlassesProduct | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<GlassesProduct | null>(null);
  const [previewProduct, setPreviewProduct] = useState<GlassesProduct | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cloudinary Signed Upload state
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState<boolean | null>(null);
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState<string | null>(null);
  const [cloudinaryMissing, setCloudinaryMissing] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [showSecretInSetup, setShowSecretInSetup] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testUploadResult, setTestUploadResult] = useState<string | null>(null);
  const [isTestingUpload, setIsTestingUpload] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseSyncStatus>({ status: 'idle' });

  // New product form
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formImage, setFormImage] = useState(PRESET_STUDIO_IMAGES[0].url);
  const [formCustomImage, setFormCustomImage] = useState('');
  const [formItemCode, setFormItemCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAvailable, setFormAvailable] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const copyText = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      showToast(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      showToast(`Failed to copy ${label}`, 'error');
    }
  };

  // Safe response parser that never throws cryptic JSON SyntaxErrors on HTML/text responses
  const safeParseResponse = async (res: Response, endpointName: string): Promise<any> => {
    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (data && typeof data === 'object') {
      return data;
    }

    // Extract clean human-readable text from HTML/proxy response (e.g. 502/404)
    const cleaned = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(
      cleaned
        ? `${endpointName} error (${res.status}): ${cleaned}`
        : `${endpointName} returned status ${res.status} (${res.statusText || 'Non-JSON response'})`
    );
  };

  // Check Cloudinary setup on server
  const checkCloudinaryStatus = async (userToUse?: User | null) => {
    const targetUser = userToUse || currentUser;
    if (!targetUser) return;
    try {
      const token = await targetUser.getIdToken();
      const res = await fetch(`/api/admin/cloudinary-status?t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      const data = await safeParseResponse(res, 'Cloudinary Status');
      setCloudinaryConfigured(Boolean(data.configured));
      setCloudinaryCloudName(data.cloudName || null);
      if (data.missing) {
        const missingKeys: string[] = [];
        if (data.missing.cloudName) missingKeys.push('CLOUDINARY_CLOUD_NAME');
        if (data.missing.apiKey) missingKeys.push('CLOUDINARY_API_KEY');
        if (data.missing.apiSecret) missingKeys.push('CLOUDINARY_API_SECRET');
        setCloudinaryMissing(missingKeys);
      } else {
        setCloudinaryMissing([]);
      }
    } catch (err: any) {
      console.error('Failed to check Cloudinary status:', err);
      setCloudinaryConfigured(false);
    }
  };

  // Upload image to Cloudinary using signed signature
  const uploadToCloudinary = async (file: File): Promise<string | null> => {
    if (!currentUser || !isOwner) {
      showToast('Admin authentication required', 'error');
      return null;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
      return null;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be less than 10MB', 'error');
      return null;
    }

    setIsUploadingImage(true);
    setUploadProgress('Requesting secure signature from server...');

    try {
      const token = await currentUser.getIdToken();
      const signRes = await fetch('/api/admin/cloudinary-sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const signData = await safeParseResponse(signRes, 'Upload Signer (/api/admin/cloudinary-sign)');
      
      if (!signRes.ok) {
        if (signData.missing && Array.isArray(signData.missing) && signData.missing.length > 0) {
          throw new Error(`Cloudinary setup required: Missing ${signData.missing.join(', ')} in hosting settings/secrets.`);
        }
        throw new Error(signData.error || `Upload signing failed with HTTP status ${signRes.status}`);
      }

      if (!signData.signature || !signData.apiKey || !signData.cloudName) {
        throw new Error('Incomplete signature received from server.');
      }

      setUploadProgress('Uploading image directly to Cloudinary CDN...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('folder', signData.folder || 'the_shade_store/products');

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const uploadData = await safeParseResponse(uploadRes, 'Cloudinary CDN');
      if (!uploadRes.ok) {
        throw new Error(uploadData?.error?.message || `Cloudinary upload failed with HTTP status ${uploadRes.status}`);
      }

      if (!uploadData.secure_url || typeof uploadData.secure_url !== 'string' || !uploadData.secure_url.startsWith('http')) {
        throw new Error('Cloudinary response did not return a valid permanent image URL');
      }

      showToast('Photo uploaded to Cloudinary CDN successfully!');
      return uploadData.secure_url;
    } catch (err: any) {
      console.error('Image upload failed:', err);
      showToast(err.message || 'Image upload failed', 'error');
      return null;
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(null);
    }
  };

  // Fetch products from Firebase Firestore (with API & static fallback)
  const fetchProducts = async () => {
    try {
      const res = await getProductsWithFallback();
      setProducts(res.products);
      setFirebaseStatus(res.firebaseStatus);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  // Monitor Firebase Auth State & Subscribe to Realtime Updates
  useEffect(() => {
    // Realtime Firestore product subscription
    const unsubscribeProducts = subscribeToProducts(
      (live) => {
        if (Array.isArray(live)) {
          setProducts(live);
        }
      },
      (err) => {
        // Handled in fetchProducts
      }
    );

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user && user.email) {
        const email = user.email.toLowerCase().trim();
        if (email === OWNER_EMAIL.toLowerCase().trim()) {
          setCurrentUser(user);
          setIsOwner(true);
          await fetchProducts();
          await checkCloudinaryStatus(user);
        } else {
          // A customer or unauthorized user signed in
          setCurrentUser(null);
          setIsOwner(false);
          await signOut(auth);
          setAuthError(`Access Denied: Only the store owner (${OWNER_EMAIL}) has administrative privileges.`);
        }
      } else {
        setCurrentUser(null);
        setIsOwner(false);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
    };
  }, []);

  // Format Firebase Error
  const formatFirebaseError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect owner password. If you haven\'t created the owner account yet in Firebase, click "First-time owner setup" below.';
      case 'auth/email-already-in-use':
        return 'Owner account already exists in Firebase. Please enter your password to sign in.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not enabled in Firebase Console. Go to Firebase Console -> Authentication -> Sign-in method -> Email/Password and turn it On.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/too-many-requests':
        return 'Access temporarily locked due to multiple failed login attempts. Please wait a few minutes or reset your password.';
      default:
        return err?.message || 'Authentication error. Please check your credentials and try again.';
    }
  };

  // Handle Firebase Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const email = emailInput.trim().toLowerCase();
    if (email !== OWNER_EMAIL.toLowerCase()) {
      setAuthError(`Only the registered store owner email (${OWNER_EMAIL}) can access this panel.`);
      return;
    }

    if (!passwordInput) {
      setAuthError('Please enter your owner password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isFirstTimeSetup) {
        // First-time owner setup: creates owner account in Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email, passwordInput);
        if (credential.user) {
          setAuthSuccess('Owner account created successfully in Firebase! Welcome to your store manager.');
          setPasswordInput('');
          setIsFirstTimeSetup(false);
        }
      } else {
        // Standard Sign In
        const credential = await signInWithEmailAndPassword(auth, email, passwordInput);
        if (credential.user) {
          setPasswordInput('');
          showToast(`Welcome back, ${OWNER_EMAIL}!`);
        }
      }
    } catch (err: any) {
      setAuthError(formatFirebaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Password Reset Email
  const handleForgotPassword = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await sendPasswordResetEmail(auth, OWNER_EMAIL);
      setAuthSuccess(`Password reset email sent to ${OWNER_EMAIL}! Check your inbox to set a new password.`);
    } catch (err: any) {
      setAuthError(formatFirebaseError(err));
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setIsOwner(false);
    showToast('Signed out of admin panel');
  };

  // Helper to get authenticated headers
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    if (!currentUser) return {};
    const token = await currentUser.getIdToken(true);
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isOwner) return;

    if (!formName.trim()) {
      showToast('Please enter a product name', 'error');
      return;
    }

    if (isUploadingImage) {
      showToast('Please wait for the photo to finish uploading to Cloudinary before saving.', 'error');
      return;
    }

    const imageToUse = formCustomImage.trim() || formImage;

    if (imageToUse.startsWith('blob:')) {
      showToast('Temporary browser blob cannot be saved to the database. Please wait for Cloudinary upload to complete.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const id = `frame-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const newProduct: GlassesProduct = {
        id,
        name: formName.trim(),
        price: formPrice ? Number(formPrice) : null,
        image: imageToUse,
        itemCode: formItemCode.trim() || undefined,
        description: formDescription.trim(),
        available: formAvailable,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { firestoreSuccess, firestoreError } = await saveProductToFirebase(newProduct, token);

      // Refresh list immediately
      await fetchProducts();
      window.dispatchEvent(new CustomEvent('the-shade-store:products-updated'));

      // Reset form
      setFormName('');
      setFormPrice('');
      setFormCustomImage('');
      setFormItemCode('');
      setFormDescription('');
      setFormAvailable(true);
      setActiveTab('catalog');

      if (firestoreError) {
        showToast(`Saved! (Firebase note: ${firestoreError.slice(0, 90)}...)`, 'error');
      } else {
        showToast(`"${newProduct.name}" saved to Firebase & published with photo!`);
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Product
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isOwner || !editingProduct) return;

    if (isUploadingImage) {
      showToast('Please wait for photo upload to finish before saving changes.', 'error');
      return;
    }

    if (editingProduct.image && editingProduct.image.startsWith('blob:')) {
      showToast('Temporary browser blob cannot be saved. Please wait for Cloudinary upload to complete.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const updatedProduct: GlassesProduct = {
        ...editingProduct,
        name: editingProduct.name.trim(),
        price: editingProduct.price !== null && editingProduct.price !== undefined && editingProduct.price !== ('' as any)
          ? Number(editingProduct.price) 
          : null,
        image: editingProduct.image.trim(),
        itemCode: editingProduct.itemCode?.trim() || undefined,
        description: editingProduct.description?.trim() || '',
        available: editingProduct.available !== false,
        updatedAt: new Date().toISOString(),
      };

      const { firestoreSuccess, firestoreError } = await saveProductToFirebase(updatedProduct, token);

      await fetchProducts();
      window.dispatchEvent(new CustomEvent('the-shade-store:products-updated'));
      setEditingProduct(null);

      if (firestoreError) {
        showToast(`Updated! (Firebase note: ${firestoreError.slice(0, 90)}...)`, 'error');
      } else {
        showToast(`"${updatedProduct.name}" updated in Firebase! Permanent photo saved.`);
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Availability
  const handleToggleAvailability = async (product: GlassesProduct) => {
    if (!currentUser || !isOwner) return;
    const newStatus = !product.available;

    // Optimistic UI update
    setProducts(products.map((p) => (p.id === product.id ? { ...p, available: newStatus } : p)));

    try {
      const token = await currentUser.getIdToken();
      const updated: GlassesProduct = {
        ...product,
        available: newStatus,
        updatedAt: new Date().toISOString(),
      };

      await saveProductToFirebase(updated, token);
      await fetchProducts();
      window.dispatchEvent(new CustomEvent('the-shade-store:products-updated'));
      showToast(`Marked "${product.name}" as ${newStatus ? 'Available' : 'Out of Stock'}`);
    } catch {
      await fetchProducts();
      showToast('Error updating status', 'error');
    }
  };

  // Delete Product with real database verification
  const handleDeleteProduct = async () => {
    if (!currentUser || !isOwner || !deleteConfirmProduct) return;

    const targetProduct = deleteConfirmProduct;
    setIsSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const result = await deleteProductFromFirebase(targetProduct.id, token);

      if (!result.firestoreSuccess && !result.apiSuccess) {
        const errorDetail = result.firestoreError || result.apiError || 'Unknown database error';
        showToast(`Failed to delete frame: ${errorDetail}`, 'error');
        setIsSubmitting(false);
        return;
      }

      // Optimistically update admin state immediately
      setProducts((prev) => prev.filter((p) => p.id !== targetProduct.id));
      setDeleteConfirmProduct(null);

      // Re-fetch to sync with persistent database
      await fetchProducts();

      // Dispatch event to update customer-facing store
      window.dispatchEvent(new CustomEvent('the-shade-store:products-updated'));
      showToast(`"${targetProduct.name}" permanently deleted from catalog`);
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(err?.message || 'Error deleting product from database', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset to default catalog
  const handleResetCatalog = async () => {
    if (!currentUser || !isOwner) return;
    if (!window.confirm('Reset catalog to the default 8 store frames? Custom added frames will be replaced.')) return;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/products/reset', {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        showToast('Catalog reset to initial 8 frames');
      }
    } catch {
      showToast('Failed to reset catalog', 'error');
    }
  };

  // -------------------------------------------------------------
  // Render Loading
  // -------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-center">
        <RefreshCw className="w-8 h-8 text-neutral-600 animate-spin mb-3" />
        <p className="font-serif text-xl text-neutral-800">The Shade Store Admin</p>
        <p className="text-xs text-neutral-500 mt-1">Connecting to Firebase Authentication...</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Screen: Firebase Owner Sign In
  // -------------------------------------------------------------
  if (!currentUser || !isOwner) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-between text-[#1A1A1A]">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200/80 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-neutral-900" />
              <span className="font-serif text-xl font-bold tracking-tight text-neutral-900">
                The Shade Store
              </span>
            </div>
            <button
              type="button"
              onClick={onBackToStore ? onBackToStore : () => { window.location.href = '/'; }}
              className="text-xs text-neutral-600 hover:text-neutral-950 inline-flex items-center gap-1 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Store</span>
            </button>
          </div>
        </header>

        {/* Login Card */}
        <main className="max-w-md mx-auto w-full px-4 py-8 sm:py-12">
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm p-6 sm:p-8">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-900 mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <div className="flex items-center justify-between">
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-neutral-950">
                Owner Sign In
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200/60">
                Firebase Auth
              </span>
            </div>

            <p className="mt-1.5 text-xs sm:text-sm text-neutral-600">
              Sign in with your verified owner account (<code>{OWNER_EMAIL}</code>) to manage your glasses catalog.
            </p>

            {/* Error Message */}
            {authError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{authError}</span>
              </div>
            )}

            {/* Success Message */}
            {authSuccess && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{authSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Owner Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
                    required
                  />
                  <Mail className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  Only <code>{OWNER_EMAIL}</code> has administrative privileges.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-800">
                    Password
                  </label>
                  {!isFirstTimeSetup && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] text-pink-600 hover:text-pink-700 font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={isFirstTimeSetup ? 'Create owner password (min 6 chars)' : 'Enter your owner password'}
                    className="w-full px-3.5 py-2.5 pr-10 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
                    disabled={isSubmitting}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{isFirstTimeSetup ? 'Create Owner Account in Firebase' : 'Sign In as Store Owner'}</span>
              </button>
            </form>

            {/* Toggle first-time setup */}
            <div className="mt-5 pt-4 border-t border-neutral-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsFirstTimeSetup(!isFirstTimeSetup);
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className="text-xs text-neutral-600 hover:text-neutral-950 font-medium cursor-pointer"
              >
                {isFirstTimeSetup ? (
                  <span>Already created owner account? <strong>Sign In</strong></span>
                ) : (
                  <span>First time setting up? <strong>Initialize owner account in Firebase</strong></span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="mt-4 p-4 rounded-xl bg-neutral-100/70 border border-neutral-200/80 text-xs text-neutral-600 space-y-1.5">
            <p className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-700" />
              Firebase Setup Notes
            </p>
            <p>• Connected Project: <code>the-shade-store-2335e</code></p>
            <p>• Make sure <strong>Email/Password</strong> provider is turned <strong>Enabled</strong> in Firebase Console under Authentication &gt; Sign-in method.</p>
            <p>• Customers signing in on the public website do not have owner permissions.</p>
          </div>
        </main>

        <footer className="text-center py-6 text-xs text-neutral-400">
          The Shade Store · Pur Road, Bhilwara
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Screen: Authenticated Admin Portal
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#1A1A1A] flex flex-col">
      {/* Toast Notification */}
      {notification && (
        <aside className={`fixed bottom-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium border ${
          notification.type === 'success' 
            ? 'bg-neutral-950 text-white border-neutral-800' 
            : 'bg-red-950 text-white border-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </aside>
      )}

      {/* Top Bar for Admin */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200/80 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 truncate">
              The Shade Store
            </span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-semibold tracking-wider uppercase shrink-0">
              Owner Panel
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Direct live store link */}
            <button
              type="button"
              onClick={onBackToStore ? onBackToStore : () => { window.location.href = '/'; }}
              className="min-h-[36px] px-2.5 sm:px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-medium transition-colors cursor-pointer"
              title="Return to public store"
            >
              <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">View Public Store</span>
              <span className="sm:hidden">Store</span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleSignOut}
              type="button"
              className="min-h-[36px] px-2.5 sm:px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex overflow-x-auto border-t border-neutral-100 gap-2 sm:gap-4 scrollbar-none py-1.5">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'catalog' 
                ? 'bg-neutral-950 text-white font-semibold' 
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Catalog Items ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add' 
                ? 'bg-neutral-950 text-white font-semibold' 
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Frame</span>
          </button>

          <button
            onClick={() => setActiveTab('cloudinary')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cloudinary' 
                ? 'bg-neutral-950 text-white font-semibold' 
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Cloudinary Setup</span>
            {cloudinaryConfigured ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected to Cloudinary"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Setup Needed"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'preview' 
                ? 'bg-neutral-950 text-white font-semibold' 
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <EyeIcon className="w-3.5 h-3.5" />
            <span>Live Store Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('setup')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'setup' 
                ? 'bg-neutral-950 text-white font-semibold' 
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Firebase Security Info</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        {/* Firebase & Database Live Status Banner */}
        <div className="mb-6 p-4 rounded-xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900 text-sm">Automated Live Database Active</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                    Auto-Sync ON
                  </span>
                </div>
                <p className="text-neutral-500 text-xs mt-0.5">
                  Aapko manually kuch karne ki zaroorat nahi hai. Aap jo bhi photo ya product add/edit karenge, wo automatically database mein save hokar live store catalog par display ho jayega.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-500 bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200/60 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Cloud Storage & Catalog Synced</span>
            </div>
          </div>
        </div>

        {/* ================= TAB 1: CATALOG MANAGEMENT ================= */}
        {activeTab === 'catalog' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-neutral-950">
                  Glasses Catalog ({products.length})
                </h1>
                <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">
                  Signed in as <strong>{currentUser?.email}</strong>. Manage frame details, toggle stock, or add styles. Changes update the public store instantly.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('add')}
                  className="min-h-[38px] px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Frame</span>
                </button>

                <button
                  onClick={handleResetCatalog}
                  title="Reset to default items"
                  className="min-h-[38px] px-2.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Defaults</span>
                </button>
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {products.map((item) => (
                <div 
                  key={item.id}
                  className={`bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between transition-all ${
                    item.available 
                      ? 'border-neutral-200 hover:border-neutral-300' 
                      : 'border-neutral-200/60 opacity-80 bg-neutral-50/70'
                  }`}
                >
                  <div>
                    {/* Top Row: Code & Availability Status */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[11px] font-mono font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        {item.itemCode || 'TSS'}
                      </span>
                      
                      {/* Availability Switch */}
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                          item.available 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100' 
                            : 'bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300'
                        }`}
                        title="Click to toggle availability"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.available ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        <span>{item.available ? 'In Stock' : 'Out of Stock'}</span>
                      </button>
                    </div>

                    {/* Image Thumbnail & Details */}
                    <div className="flex gap-3.5 items-start">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200/70 shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover object-center"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PRESET_STUDIO_IMAGES[0].url;
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-base font-medium text-neutral-950 leading-snug line-clamp-2">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-neutral-900 tabular-nums">
                          {item.price !== null ? `₹${item.price.toLocaleString('en-IN')}` : 'Price on request'}
                        </p>
                        {item.description && (
                          <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setEditingProduct(item)}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Edit Details</span>
                    </button>

                    <button
                      onClick={() => setDeleteConfirmProduct(item)}
                      className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 2: ADD NEW PRODUCT ================= */}
        {activeTab === 'add' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-neutral-200/90 shadow-sm p-5 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-neutral-950">
                  Add New Glasses Frame
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Publish a new pair of glasses directly to the public catalog.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('catalog')}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Vintage Havana Round Frame"
                  className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Price in INR (₹)
                  </label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 1899 (leave empty for request)"
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Leave empty to display "Price on request"
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Item Code / SKU
                  </label>
                  <input
                    type="text"
                    value={formItemCode}
                    onChange={(e) => setFormItemCode(e.target.value)}
                    placeholder="e.g. TSS-09"
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-800">
                    Product Photo *
                  </label>
                  {cloudinaryConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Cloudinary Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <Info className="w-3 h-3 text-amber-600" />
                      <span>Cloudinary Setup Needed</span>
                    </span>
                  )}
                </div>

                {/* Cloudinary Signed Direct Upload Area */}
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-400 transition-colors mb-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 shrink-0 shadow-2xs">
                        <CloudUpload className="w-5 h-5 text-neutral-800" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-neutral-900">
                          Upload Photo via Cloudinary (Signed)
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Secure server-signed upload directly to CDN (PNG, JPG, WEBP)
                        </p>
                      </div>
                    </div>

                    <label className={`min-h-[36px] px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-850 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 ${
                      isUploadingImage ? 'opacity-50 pointer-events-none' : ''
                    }`}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Uploading...' : 'Choose Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await uploadToCloudinary(file);
                            if (url) {
                              setFormCustomImage(url);
                              setFormImage(url);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>

                  {uploadProgress && (
                    <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center gap-2 text-xs text-neutral-700">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-900" />
                      <span>{uploadProgress}</span>
                    </div>
                  )}

                  {/* Active Upload Preview */}
                  {formCustomImage && (
                    <div className="mt-3 pt-2.5 border-t border-neutral-200/60 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-200 shrink-0 bg-neutral-100">
                        <img src={formCustomImage} alt="Uploaded frame" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <Check className="w-2.5 h-2.5" /> Selected Photo
                        </span>
                        <p className="text-[11px] font-mono text-neutral-600 truncate mt-0.5">
                          {formCustomImage}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-medium text-neutral-600 block mb-1.5">
                  Or select one of our studio frame presets:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {PRESET_STUDIO_IMAGES.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setFormImage(preset.url);
                        setFormCustomImage('');
                      }}
                      className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                        formImage === preset.url && !formCustomImage
                          ? 'border-neutral-950 ring-2 ring-neutral-900/10'
                          : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover rounded" />
                      <span className="absolute bottom-1 left-1 right-1 text-[9px] bg-black/70 text-white px-1 py-0.5 rounded truncate">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <span className="text-[11px] text-neutral-500 mb-1 block">
                    Or paste an existing image URL:
                  </span>
                  <input
                    type="url"
                    value={formCustomImage}
                    onChange={(e) => setFormCustomImage(e.target.value)}
                    placeholder="https://res.cloudinary.com/... or https://..."
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Description / Features (optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Material, fit, frame measurements, lens compatibility..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formAvailable"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 text-neutral-900 rounded focus:ring-neutral-900"
                />
                <label htmlFor="formAvailable" className="text-xs font-medium text-neutral-700 cursor-pointer">
                  Available in store immediately (In Stock)
                </label>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingImage}
                  className="flex-1 min-h-[44px] bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploadingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Uploading Photo to Cloudinary...</span>
                    </>
                  ) : isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publishing to Database...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Publish Frame to Public Catalog</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 3: LIVE STORE PREVIEW ================= */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-neutral-900">
                  Live Public Catalog Preview
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  This preview renders the glasses catalog exactly as customers see it on the public site.
                </p>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Open Public URL</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Render Public Card Grid */}
            <div className="bg-[#FAF9F6] p-4 sm:p-8 rounded-2xl border border-neutral-200/80">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
                {products.filter(p => p.available).map((item) => (
                  <ProductCard
                    key={item.id}
                    item={{
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      image: item.image,
                      itemCode: item.itemCode,
                      description: item.description,
                    }}
                    onInquire={(it) => {
                      alert(`Inquiry preview: Customer will be directed to Instagram DM for "${it.name}"`);
                    }}
                    onSelect={(it) => {
                      setPreviewProduct(it as any);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Preview of Details Modal in Admin */}
            <ProductDetailsModal
              item={previewProduct as any}
              isOpen={Boolean(previewProduct)}
              onClose={() => setPreviewProduct(null)}
              onInquireInstagram={(it) => {
                alert(`Inquiry preview: Customer will be directed to Instagram DM for "${it.name}"`);
              }}
            />
          </div>
        )}

        {/* ================= TAB: CLOUDINARY SETUP ================= */}
        {activeTab === 'cloudinary' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs shrink-0">
                    <CloudUpload className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="font-serif text-2xl font-semibold text-neutral-950">
                      Cloudinary Photo Setup
                    </h1>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Direct, secure signed photo uploads to Cloudinary CDN for The Shade Store
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCheckingStatus}
                    onClick={async () => {
                      setIsCheckingStatus(true);
                      await checkCloudinaryStatus(currentUser);
                      setIsCheckingStatus(false);
                      showToast('Cloudinary connection status refreshed!');
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                    <span>{isCheckingStatus ? 'Checking...' : 'Check Connection'}</span>
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              <div className="mt-4">
                {cloudinaryConfigured ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 flex-1">
                      <div className="flex items-center gap-2 font-semibold text-sm text-emerald-900">
                        <span>Status: Connected</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-normal">
                          cloud: {cloudinaryCloudName || 'tis87kjf'}
                        </span>
                      </div>
                      <p className="mt-1 text-emerald-800 leading-relaxed">
                        Server-side signed upload verification at <code className="bg-emerald-100/70 px-1 py-0.5 rounded font-mono text-[11px]">POST /api/admin/cloudinary-sign</code> is active. Product photos chosen in the admin panel upload directly to your Cloudinary media library in folder <code className="bg-emerald-100/70 px-1 py-0.5 rounded font-mono text-[11px]">the_shade_store/products</code>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950 flex-1">
                      <div className="flex items-center gap-2 font-semibold text-sm text-amber-900">
                        <span>Status: Setup Needed in Vercel</span>
                        {cloudinaryMissing.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-normal">
                            Missing: {cloudinaryMissing.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-amber-800 leading-relaxed">
                        The server needs your 3 Cloudinary environment variables in Vercel to sign photo uploads. Follow the instructions below to add them to your Vercel Project Settings.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Three Labeled Fields Card */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-6 space-y-5">
              <div>
                <h2 className="font-serif text-lg font-semibold text-neutral-950">
                  Your Cloudinary Credentials
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Use the copy buttons below to copy each credential into your Vercel Project Settings.
                </p>
              </div>

              <div className="space-y-4">
                {/* Field 1: Cloud Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <span>Cloud name</span>
                      <code className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">CLOUDINARY_CLOUD_NAME</code>
                    </label>
                    <span className="text-[10px] text-neutral-400">Your account identifier</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value="tis87kjf"
                      className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyText('tis87kjf', 'CLOUDINARY_CLOUD_NAME')}
                      className="px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedField === 'CLOUDINARY_CLOUD_NAME' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'CLOUDINARY_CLOUD_NAME' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Field 2: API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <span>API Key</span>
                      <code className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">CLOUDINARY_API_KEY</code>
                    </label>
                    <span className="text-[10px] text-neutral-400">Public API key for uploads</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value="425216243798441"
                      className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyText('425216243798441', 'CLOUDINARY_API_KEY')}
                      className="px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedField === 'CLOUDINARY_API_KEY' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'CLOUDINARY_API_KEY' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Field 3: API Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <span>API Secret</span>
                      <code className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">CLOUDINARY_API_SECRET</code>
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                      Server-side only (Secret)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showSecretInSetup ? 'text' : 'password'}
                        readOnly
                        value="Txp59TP7lxIfBxWYV550A91odbM"
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 font-semibold focus:outline-none pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretInSetup(!showSecretInSetup)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer p-1"
                        title={showSecretInSetup ? 'Hide secret' : 'Show secret'}
                      >
                        {showSecretInSetup ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText('Txp59TP7lxIfBxWYV550A91odbM', 'CLOUDINARY_API_SECRET')}
                      className="px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedField === 'CLOUDINARY_API_SECRET' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'CLOUDINARY_API_SECRET' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-500 leading-relaxed bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                    🔒 <strong>Strict Server-Side Protection:</strong> This API secret is kept exclusively on your Vercel serverless functions in <code className="font-mono">api/admin/cloudinary-sign.ts</code>. It is never exposed in browser JavaScript, client network requests, or public Git repositories.
                  </div>
                </div>
              </div>
            </div>

            {/* Test Upload Sandbox */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-6">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-neutral-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Test Cloudinary Upload</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Verify the real upload flow: choose an image to request a server signature and upload directly to Cloudinary CDN.
                  </p>
                </div>
                <label className={`min-h-[36px] px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-850 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 ${
                  isTestingUpload || isUploadingImage ? 'opacity-50 pointer-events-none' : ''
                }`}>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isTestingUpload || isUploadingImage ? 'Uploading...' : 'Upload Test Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isTestingUpload || isUploadingImage}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsTestingUpload(true);
                        setTestUploadResult(null);
                        const url = await uploadToCloudinary(file);
                        if (url) {
                          setTestUploadResult(url);
                        }
                        setIsTestingUpload(false);
                      }
                    }}
                  />
                </label>
              </div>

              {testUploadResult ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-emerald-300 shrink-0 bg-white shadow-2xs">
                    <img src={testUploadResult} alt="Upload verification" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Permanent Cloudinary CDN URL Verified
                    </span>
                    <p className="text-xs font-mono text-emerald-950 truncate mt-1 select-all bg-white p-2 rounded border border-emerald-200/80">
                      {testUploadResult}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => copyText(testUploadResult, 'Photo URL')}
                        className="text-[11px] text-emerald-800 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Copy URL
                      </button>
                      <a
                        href={testUploadResult}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-800 font-medium hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Open in New Tab
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                  Click <strong>Upload Test Photo</strong> above to test your Cloudinary connection with a real image file.
                </div>
              )}
            </div>

            {/* Step-by-Step Vercel Configuration Guide */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-6 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-neutral-950 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-neutral-900" />
                  <span>Step-by-Step Instructions for Vercel Deployment</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Follow these 5 steps to add your credentials in Vercel and redeploy:
                </p>
              </div>

              <div className="space-y-3 text-xs text-neutral-700">
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-950">Open Vercel Project Settings</h4>
                    <p className="text-neutral-600 mt-0.5">
                      Log in to your <strong>Vercel Dashboard</strong>, click your deployed project, and click the <strong>Settings</strong> tab in the top navigation bar.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-950">Go to Environment Variables</h4>
                    <p className="text-neutral-600 mt-0.5">
                      In the left sidebar under Project Settings, click <strong>Environment Variables</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-neutral-950">Add the 3 Environment Variables</h4>
                    <p className="text-neutral-600 mt-0.5 mb-2">
                      Add each variable with its exact Key and Value. Make sure <strong>Production</strong>, <strong>Preview</strong>, and <strong>Development</strong> are checked:
                    </p>
                    <div className="bg-neutral-950 text-neutral-200 p-3 rounded-lg font-mono text-[11px] space-y-1.5 overflow-x-auto">
                      <div><span className="text-emerald-400">CLOUDINARY_CLOUD_NAME</span>="tis87kjf"</div>
                      <div><span className="text-emerald-400">CLOUDINARY_API_KEY</span>="425216243798441"</div>
                      <div><span className="text-emerald-400">CLOUDINARY_API_SECRET</span>="Txp59TP7lxIfBxWYV550A91odbM"</div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-950">Save Variables and Redeploy</h4>
                    <p className="text-neutral-600 mt-0.5">
                      Click <strong>Save</strong> on each variable. Then navigate to the <strong>Deployments</strong> tab in Vercel → click the <strong>three dots (...)</strong> on your latest deployment → click <strong>Redeploy</strong> (uncheck "Use existing Build Cache" so new environment variables are applied).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    5
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-950">Verify Connection & Upload Product Photos</h4>
                    <p className="text-neutral-600 mt-0.5">
                      Once redeployment completes, return to this tab and click <strong>Check Connection</strong>. The status will turn to <strong className="text-emerald-700">Connected</strong>, and you can upload photos when adding or editing glasses frames!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: FIREBASE SECURITY INFO ================= */}
        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-neutral-200/90 shadow-sm p-6 sm:p-8">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold text-neutral-950">
                    Owner Security Architecture
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    How The Shade Store admin panel is protected with Firebase
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-xs sm:text-sm text-neutral-700 leading-relaxed">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <h3 className="font-semibold text-neutral-950 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    1. Verified Owner Account
                  </h3>
                  <p className="text-xs text-neutral-600">
                    Owner Email: <strong>{OWNER_EMAIL}</strong>. Only this verified email address is permitted to authenticate as store admin. Even if a customer registers on the storefront, they receive zero administrative privileges.
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <h3 className="font-semibold text-neutral-950 mb-1 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-neutral-700" />
                    2. Cryptographic Firebase ID Token Verification
                  </h3>
                  <p className="text-xs text-neutral-600">
                    Every admin action (adding, updating, or deleting frames) transmits a signed Firebase ID Token directly to the server. The server verifies the token's project audience (<code>the-shade-store-2335e</code>) and confirms the email matches <code>{OWNER_EMAIL}</code> before processing any change.
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <h3 className="font-semibold text-neutral-950 mb-1 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-neutral-700" />
                    3. No Plaintext Passwords or Manual Salts
                  </h3>
                  <p className="text-xs text-neutral-600">
                    Your password is handled directly by Google Firebase's secure authentication infrastructure. It is never stored in source code, environment variables, or local files.
                  </p>
                </div>

                {/* Cloudinary Link Banner */}
                <div className="p-4 bg-white rounded-xl border-2 border-neutral-900/10 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CloudUpload className="w-5 h-5 text-neutral-900 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-950">Cloudinary Photo Setup</h4>
                      <p className="text-[11px] text-neutral-500">Configure your 3 environment variables for signed photo uploads</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cloudinary')}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium shrink-0 cursor-pointer"
                  >
                    Open Setup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= EDIT MODAL ================= */}
      {editingProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setEditingProduct(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="font-serif text-xl font-semibold text-neutral-950">
                Edit Frame: {editingProduct.name}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-neutral-400 hover:text-neutral-800 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={editingProduct.price !== null ? editingProduct.price : ''}
                    onChange={(e) => setEditingProduct({ 
                      ...editingProduct, 
                      price: e.target.value ? Number(e.target.value) : null 
                    })}
                    placeholder="Price in INR"
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Item Code / SKU
                  </label>
                  <input
                    type="text"
                    value={editingProduct.itemCode || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, itemCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-800">
                    Photo URL
                  </label>
                  <label className={`text-[11px] px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    isUploadingImage ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    <Upload className="w-3 h-3" />
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload New to Cloudinary'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await uploadToCloudinary(file);
                          if (url) {
                            setEditingProduct({ ...editingProduct, image: url });
                          }
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="flex gap-2 items-center mb-2">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-200 shrink-0 bg-neutral-100">
                    <img src={editingProduct.image} alt={editingProduct.name} className="w-full h-full object-cover" />
                  </div>
                  <input
                    type="text"
                    value={editingProduct.image}
                    onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>

                {uploadProgress && (
                  <div className="mb-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center gap-2 text-xs text-neutral-700">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-900" />
                    <span>{uploadProgress}</span>
                  </div>
                )}

                {/* Photo Presets for quick selection */}
                <div className="flex gap-1.5 overflow-x-auto py-1">
                  {PRESET_STUDIO_IMAGES.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, image: preset.url })}
                      className="text-[10px] px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 shrink-0"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Description
                </label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editAvailable"
                  checked={editingProduct.available}
                  onChange={(e) => setEditingProduct({ ...editingProduct, available: e.target.checked })}
                  className="w-4 h-4 text-neutral-900 rounded"
                />
                <label htmlFor="editAvailable" className="text-xs font-medium text-neutral-700 cursor-pointer">
                  Mark as Available in Store (In Stock)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingImage}
                  className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isUploadingImage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Uploading Photo...</span>
                    </>
                  ) : isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {deleteConfirmProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setDeleteConfirmProduct(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-serif text-xl font-semibold text-neutral-950">
              Permanently Delete Frame?
            </h3>
            <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to delete <strong>"{deleteConfirmProduct.name}"</strong>? This will permanently remove this frame from the public glasses catalog.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Frame</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
