/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  MapPin, 
  ArrowDown, 
  CheckCircle2, 
  ExternalLink,
  Shield
} from 'lucide-react';
import { GLASSES_CATALOG, SHOP_INFO, GlassesItem } from './data/glassesCatalog';
import { getProductsWithFallback, subscribeToProducts, GlassesProduct } from './firebase/productsService';
import { ProductCard } from './components/ProductCard';
import { UserMenu } from './components/UserMenu';
import { AuthModal } from './components/AuthModal';
import { ProductDetailsModal } from './components/ProductDetailsModal';
import { WhatsAppIcon } from './components/WhatsAppIcon';
import { useAuth } from './context/AuthContext';

// Code-split AdminPage: Loads admin code on-demand only when visiting /admin, keeping customer public bundle lightweight
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

const OWNER_EMAIL = 'beingmagrajwork@gmail.com';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.email?.toLowerCase().trim() === OWNER_EMAIL.toLowerCase();

  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return window.location.pathname.startsWith('/admin');
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [catalogItems, setCatalogItems] = useState<GlassesItem[]>(GLASSES_CATALOG);

  // Selected product state for tap-to-view details modal
  const [selectedProduct, setSelectedProduct] = useState<GlassesItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // If a non-owner user attempts to directly open /admin while signed in, return them to public storefront
  useEffect(() => {
    if (!authLoading && user && !isOwner && isAdminRoute) {
      setIsAdminRoute(false);
      window.history.replaceState({}, '', '/');
    }
  }, [authLoading, user, isOwner, isAdminRoute]);

  // Fetch live products from Firebase Firestore (with API & static catalog fallback)
  const fetchLiveProducts = async () => {
    try {
      const { products } = await getProductsWithFallback();
      if (Array.isArray(products)) {
        // Filter out unavailable items for customers
        const availableOnly = products.filter((item) => item.available !== false);
        setCatalogItems(availableOnly);
      }
    } catch (err) {
      console.warn('Error fetching live products:', err);
    }
  };

  useEffect(() => {
    fetchLiveProducts();

    // 1. Realtime Firestore listener: updates reflect immediately across devices for all customers
    const unsubscribeFirestore = subscribeToProducts(
      (liveProducts) => {
        if (Array.isArray(liveProducts)) {
          const availableOnly = liveProducts.filter((item) => item.available !== false);
          setCatalogItems(availableOnly);
        }
      },
      (err) => {
        // Fallback already handled
      }
    );

    // 2. Listen to custom event dispatched when Admin saves or deletes a product
    const handleUpdateEvent = () => {
      fetchLiveProducts();
    };

    window.addEventListener('the-shade-store:products-updated', handleUpdateEvent);
    return () => {
      unsubscribeFirestore();
      window.removeEventListener('the-shade-store:products-updated', handleUpdateEvent);
    };
  }, []);

  // When switching from Admin back to Store, refresh immediately
  useEffect(() => {
    if (!isAdminRoute) {
      fetchLiveProducts();
    }
  }, [isAdminRoute]);

  // Render Admin Portal if visiting /admin
  if (isAdminRoute) {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center mb-3 shadow-xs animate-pulse">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="font-serif text-xl font-semibold text-neutral-900">The Shade Store Admin</p>
          <p className="text-xs text-neutral-500 mt-1">Opening store manager...</p>
        </div>
      }>
        <AdminPage 
          onBackToStore={() => {
            setIsAdminRoute(false);
            window.history.pushState({}, '', '/');
          }} 
        />
      </React.Suspense>
    );
  }

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
      }
    } catch {
      return false;
    }
  };

  const handleInquire = async (item: GlassesItem) => {
    const formattedPrice = item.price !== null 
      ? `₹${item.price.toLocaleString('en-IN')}` 
      : 'Price on request';
    
    const message = `Hi The Shade Store! I'm interested in the "${item.name}"${item.price ? ` (${formattedPrice})` : ''} from your catalog. Is this frame currently available in store?`;
    
    // Copy inquiry message to clipboard for easy DM pasting
    await copyToClipboard(message);

    // Show temporary feedback toast
    setToastMessage(`Inquiry details for "${item.name}" copied! Opening Instagram...`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);

    // Open shop's Instagram profile
    window.open(SHOP_INFO.instagramUrl, '_blank', 'noopener,noreferrer');
  };

  const scrollToCatalog = () => {
    const catalogElement = document.getElementById('catalog');
    if (catalogElement) {
      catalogElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col bg-[#FAF9F6] text-[#1A1A1A]">
      {/* Toast Notification (Mobile-safe positioning) */}
      {toastMessage && (
        <aside 
          aria-label="Notification"
          className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 bg-neutral-900 text-white p-3.5 sm:p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-neutral-700 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed flex-1 min-w-0">
            <p className="font-semibold text-white">Inquiry message copied!</p>
            <p className="text-neutral-300 mt-0.5 break-words">{toastMessage}</p>
            <p className="text-[11px] text-pink-300 mt-1 font-medium">Paste directly into your Instagram DM to send.</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-neutral-400 hover:text-white p-1 text-xs shrink-0 cursor-pointer"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </aside>
      )}

      {/* 1. Header */}
      <header className="sticky top-0 z-40 w-full bg-[#FAF9F6]/95 backdrop-blur-md border-b border-neutral-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Shop Name - Full display */}
          <a 
            href="#" 
            className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 hover:opacity-90 transition-opacity whitespace-nowrap"
            title="The Shade Store Home"
          >
            {SHOP_INFO.name}
          </a>

          {/* User Account / Sign In */}
          <div className="flex items-center gap-2 shrink-0">
            <UserMenu 
              onOpenAuth={handleOpenAuth} 
              onOpenAdmin={() => {
                setIsAdminRoute(true);
                window.history.pushState({}, '', '/admin');
              }}
            />
          </div>
        </div>
      </header>

      {/* 2. Hero Section (Clean, uncluttered, mobile-first with Instagram as Main CTA) */}
      <section className="relative w-full border-b border-neutral-200/70 overflow-hidden bg-gradient-to-b from-neutral-50 to-[#FAF9F6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-18">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-12 items-center">
            {/* Hero Copy */}
            <div className="lg:col-span-6 flex flex-col items-start w-full">
              <span className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-2 sm:mb-3 block break-words">
                Optical & Sunglasses · Bhilwara
              </span>
              
              <h1 className="font-serif text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight text-neutral-950 leading-[1.15] break-words text-balance">
                Find your frame.
              </h1>
              
              <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-neutral-600 font-normal leading-relaxed max-w-lg break-words">
                Browse our collection of frames and sunglasses below. Follow us on Instagram for daily styles, stock updates, or to confirm in-store availability.
              </p>

              {/* Hero Action Buttons - Instagram as the Main Call To Action */}
              <div className="mt-6 sm:mt-8 w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5">
                {/* Main Prominent Instagram Call to Action */}
                <a
                  href={SHOP_INFO.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto min-h-[48px] sm:min-h-[50px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:brightness-110 active:scale-[0.98] text-white rounded-xl text-base font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer group"
                >
                  <Instagram className="w-5 h-5 text-white shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Follow us on Instagram</span>
                </a>

                {/* Secondary Browse Glasses Button */}
                <button
                  onClick={scrollToCatalog}
                  type="button"
                  className="w-full sm:w-auto min-h-[48px] sm:min-h-[50px] inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-neutral-900 border border-neutral-300 rounded-xl text-base font-medium shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Browse Glasses</span>
                  <ArrowDown className="w-4 h-4 text-neutral-600 animate-bounce" />
                </button>
              </div>

              {/* WhatsApp Quick Link & Address */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-600">
                <a
                  href={SHOP_INFO.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
                  title="Chat directly on WhatsApp"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                  <span>Chat on WhatsApp: {SHOP_INFO.phone}</span>
                </a>
                <span className="hidden sm:inline text-neutral-300">·</span>
                <span className="text-neutral-500">Pur Road, near Sanganeri Gate</span>
              </div>
            </div>

            {/* Hero Eyewear Image */}
            <div className="lg:col-span-6 w-full">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-neutral-200/80 bg-neutral-100 aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3]">
                <img
                  src={SHOP_INFO.heroImage}
                  alt="Curated eyewear frames at The Shade Store"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 text-white">
                  <p className="font-serif text-base sm:text-lg font-medium drop-shadow-xs">{SHOP_INFO.name}</p>
                  <p className="text-xs text-neutral-200 drop-shadow-xs">Eyewear Collection · In-Store Trial</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Glasses Catalog Section (Unified mixed grid, compact & neatly arranged) */}
      <section id="catalog" className="w-full py-8 sm:py-14 px-3 sm:px-4 md:px-6 max-w-6xl mx-auto flex-1">
        {/* Section Heading */}
        <div className="mb-5 sm:mb-7 text-center max-w-xl mx-auto">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-neutral-900 font-normal break-words">
            Glasses Collection
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-600 leading-relaxed break-words">
            All frames displayed together. Browse every style in our catalog below.
          </p>
        </div>

        {/* Instagram Inquiry Explanation Banner (Responsive & Compact) */}
        <div className="mb-5 sm:mb-7 p-3 sm:p-4 bg-neutral-100/90 rounded-xl border border-neutral-200/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs sm:text-sm text-neutral-700 w-full">
          <div className="flex items-start gap-2.5 min-w-0">
            <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500 shrink-0 mt-0.5" />
            <div className="min-w-0 text-left">
              <p className="font-semibold text-neutral-900 text-xs sm:text-sm break-words">How to inquire about any frame:</p>
              <p className="text-neutral-600 mt-0.5 text-[11px] sm:text-xs leading-relaxed break-words">
                Tap <strong className="text-neutral-900 font-medium">Ask on Instagram</strong> on any frame to copy its name and message our profile (<a href={SHOP_INFO.instagramUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-neutral-950">{SHOP_INFO.instagramHandle}</a>) to confirm in-store availability.
              </p>
            </div>
          </div>
          
          <a
            href={SHOP_INFO.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:brightness-110 text-white rounded-lg font-medium text-xs whitespace-nowrap shadow-2xs transition-all shrink-0 cursor-pointer"
          >
            <span>Explore our Instagram</span>
            <ExternalLink className="w-3.5 h-3.5 text-white shrink-0" />
          </a>
        </div>

        {/* Unified Mixed Product Grid - 2 columns on mobile, 3 on tablet, 4 on desktop */}
        {catalogItems.length === 0 ? (
          <div className="py-12 sm:py-16 text-center max-w-md mx-auto px-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs">
            <Instagram className="w-8 h-8 text-pink-500 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-medium text-neutral-900">New Collection Coming Soon</h3>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Our latest frames are being photographed. Explore our Instagram page for today's in-store frames and new arrivals.
            </p>
            <a
              href={SHOP_INFO.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white rounded-xl text-xs font-semibold shadow-xs hover:brightness-110 transition-all cursor-pointer"
            >
              <Instagram className="w-4 h-4 text-white" />
              <span>View Frames on Instagram</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5 w-full items-stretch">
            {catalogItems.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onInquire={handleInquire}
                onSelect={(it) => {
                  setSelectedProduct(it);
                  setIsDetailsModalOpen(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Subdued Bottom Note */}
        <div className="mt-8 sm:mt-10 text-center text-xs text-neutral-500 max-w-md mx-auto px-2">
          <p className="leading-relaxed">
            Want to see how a frame looks in person? Visit our store on Pur Road, Bhilwara to try them on.
          </p>
        </div>
      </section>

      {/* 4. Contact Information at the bottom */}
      <footer className="mt-auto w-full bg-neutral-950 text-neutral-300 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-white tracking-tight break-words">
              {SHOP_INFO.name}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-neutral-400 break-words">
              Bhilwara, Rajasthan, India
            </p>

            {/* Direct Contact Details Block (Instagram as Most Prominent Action) */}
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-neutral-800/80 grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5 text-left w-full">
              {/* WhatsApp Card (Replaces Phone, opens WhatsApp link) */}
              <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800/90 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block mb-1">
                    WhatsApp
                  </span>
                  <a
                    href={SHOP_INFO.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center gap-2 text-base font-medium text-white hover:text-emerald-300 active:text-emerald-200 transition-colors break-words"
                    title={`Chat on WhatsApp: ${SHOP_INFO.phone}`}
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0" />
                    <span>{SHOP_INFO.phone}</span>
                  </a>
                </div>
                <a
                  href={SHOP_INFO.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 text-xs font-medium transition-colors w-full cursor-pointer"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>

              {/* Instagram Card (MOST PROMINENT CALL TO ACTION) */}
              <div className="relative bg-gradient-to-b from-neutral-900 to-neutral-950 p-4 rounded-xl border-2 border-pink-500/40 shadow-lg shadow-pink-950/20 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] uppercase tracking-wider text-pink-300 font-semibold">
                      Main Channel
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-[#833AB4] to-[#FD1D1D] text-white">
                      Featured
                    </span>
                  </div>
                  <a
                    href={SHOP_INFO.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[32px] inline-flex items-center gap-2 text-base font-bold text-white hover:text-pink-300 transition-colors break-words"
                  >
                    <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                    <span>{SHOP_INFO.instagramHandle}</span>
                  </a>
                  <p className="mt-1 text-xs text-neutral-300 leading-normal">
                    Follow us for new frame arrivals & direct message inquiries
                  </p>
                </div>

                {/* Highly prominent Instagram Button */}
                <a
                  href={SHOP_INFO.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:brightness-110 active:scale-[0.98] text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Instagram className="w-4 h-4 text-white shrink-0" />
                  <span>Follow us on Instagram</span>
                </a>
              </div>

              {/* Store Address Card */}
              <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800/90 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block mb-1">
                    Store Address
                  </span>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                    <p className="text-xs leading-relaxed text-neutral-200 break-words">
                      {SHOP_INFO.address}
                    </p>
                  </div>
                </div>
                <a
                  href={SHOP_INFO.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700/80 text-pink-300 hover:text-pink-200 text-xs font-medium transition-colors w-full cursor-pointer"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>

            {/* Copyright & Location Line */}
            <div className="mt-8 pt-5 border-t border-neutral-900 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <span>© {new Date().getFullYear()} {SHOP_INFO.name}. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span>Pur Road, Bhilwara, Rajasthan 311001</span>
                {!user && (
                  <button
                    onClick={() => handleOpenAuth('signin')}
                    className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                    title="Owner Login"
                  >
                    Owner Login
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Owner Admin Quick Access (Strictly visible only to beingmagrajwork@gmail.com) */}
      {isOwner && (
        <aside className="fixed bottom-4 right-4 z-40">
          <button
            onClick={() => {
              setIsAdminRoute(true);
              window.history.pushState({}, '', '/admin');
            }}
            className="px-3.5 py-2.5 bg-neutral-950 hover:bg-neutral-850 text-white rounded-xl shadow-xl border border-neutral-700/80 flex items-center gap-2 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
            title="Open Owner Admin Panel"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Owner Admin Panel</span>
          </button>
        </aside>
      )}

      {/* Customer Product Details & Information Modal */}
      <ProductDetailsModal
        item={selectedProduct}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedProduct(null);
        }}
        onInquireInstagram={(item) => {
          handleInquire(item);
        }}
      />

      {/* Firebase Sign In & Sign Up Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
