import React, { useState, useEffect } from 'react';
import { 
  X, 
  Instagram, 
  MapPin, 
  Copy, 
  Check, 
  Sparkles, 
  Eye, 
  Layers, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  ImageOff
} from 'lucide-react';
import { GlassesItem, SHOP_INFO } from '../data/glassesCatalog';
import { WhatsAppIcon } from './WhatsAppIcon';

interface ProductDetailsModalProps {
  item: GlassesItem | null;
  isOpen: boolean;
  onClose: () => void;
  onInquireInstagram: (item: GlassesItem) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  item,
  isOpen,
  onClose,
  onInquireInstagram,
}) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const allImages = React.useMemo(() => {
    if (!item) return [];
    const list: string[] = [];
    if (Array.isArray(item.images) && item.images.length > 0) {
      item.images.forEach(img => {
        if (img && typeof img === 'string' && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      });
    }
    if (item.image && typeof item.image === 'string' && !list.includes(item.image.trim())) {
      list.unshift(item.image.trim());
    }
    return list;
  }, [item?.id, item?.image, item?.images]);

  useEffect(() => {
    setImgError(false);
    setActiveImageIndex(0);
  }, [item?.id, item?.image]);

  const currentDisplayImage = allImages[activeImageIndex] || item?.image || '';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const formattedPrice = item.price !== null
    ? `₹${item.price.toLocaleString('en-IN')}`
    : 'Price on request';

  const defaultMessage = `Hi The Shade Store! I'm interested in the "${item.name}" (Code: ${item.itemCode || 'TSS'}${item.price ? `, Price: ${formattedPrice}` : ''}). Is this frame available for trial in your Bhilwara store?`;

  const whatsappInquireUrl = `${SHOP_INFO.whatsappUrl}?text=${encodeURIComponent(defaultMessage)}`;

  const handleCopyDetails = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(defaultMessage);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = defaultMessage;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto flex flex-col text-neutral-900 border border-neutral-200/90 animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Bar with Close Button */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              {item.itemCode || 'TSS FRAME'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Available in Store</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Main Visual & Key Data */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
            {/* Large Image Showcase & Gallery */}
            <div className="sm:col-span-6 w-full space-y-2.5">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#F5F4F0] border border-neutral-200/80 shadow-2xs">
                {imgError || !currentDisplayImage ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-400 bg-neutral-100">
                    <div className="w-12 h-12 rounded-full bg-neutral-200/80 flex items-center justify-center mb-2 text-neutral-500">
                      <ImageOff className="w-6 h-6" />
                    </div>
                    <span className="font-serif text-sm font-medium text-neutral-700">{item.name}</span>
                    <span className="text-xs text-neutral-500 mt-1">
                      {imgError ? 'Image failed to load' : 'No photo uploaded'}
                    </span>
                  </div>
                ) : (
                  <img
                    src={currentDisplayImage}
                    alt={`${item.name} view ${activeImageIndex + 1}`}
                    className="w-full h-full object-cover object-center transition-all duration-200"
                    onError={() => setImgError(true)}
                  />
                )}
                {item.itemCode && (
                  <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide">
                    {item.itemCode}
                  </div>
                )}
                {allImages.length > 1 && (
                  <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-medium tracking-wide">
                    {activeImageIndex + 1} / {allImages.length}
                  </div>
                )}
              </div>

              {/* Multi-Photo Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                  {allImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveImageIndex(idx);
                        setImgError(false);
                      }}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all p-0.5 shrink-0 cursor-pointer ${
                        activeImageIndex === idx
                          ? 'border-neutral-900 ring-2 ring-neutral-900/10 scale-102'
                          : 'border-neutral-200 hover:border-neutral-400 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover rounded" />
                    </button>
                  ))}
                </div>
              )}

              <p className="text-center text-[11px] text-neutral-400">
                In-store studio photography · Pur Road, Bhilwara
              </p>
            </div>

            {/* Title, Pricing & Highlights */}
            <div className="sm:col-span-6 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 block mb-1">
                  The Shade Store · Eyewear
                </span>
                <h1 className="font-serif text-xl sm:text-2xl font-semibold text-neutral-950 leading-tight">
                  {item.name}
                </h1>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-neutral-950 tabular-nums">
                    {formattedPrice}
                  </span>
                  {item.price !== null && (
                    <span className="text-xs text-neutral-500">
                      (Tax included)
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                  Available for in-person trial, prescription fitting, and instant adjustments at our Bhilwara optical store.
                </p>
              </div>

              {/* Quick Feature Badges */}
              <div className="mt-4 pt-3 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block font-medium">Fitting</span>
                  <span className="text-neutral-800 font-semibold">Universal Fit</span>
                </div>
                <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block font-medium">Lenses</span>
                  <span className="text-neutral-800 font-semibold">All Prescriptions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Description Section */}
          <div className="bg-neutral-50/80 rounded-xl p-4 border border-neutral-200/70 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-neutral-800" />
              <span>Frame Information & Specs</span>
            </h3>

            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
              {item.description || "Handcrafted premium optical frame engineered with precision spring hinges, comfortable nose bridge support, and durable lightweight finish for daily wear."}
            </p>

            <div className="pt-2 border-t border-neutral-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Single Vision & Progressive Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Blue Cut / Computer Lens Fitting</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Zero-Power Fashion Wear</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Free In-Store Frame Adjustment</span>
              </div>
            </div>
          </div>

          {/* Direct Contact & Store Actions */}
          <div className="space-y-2.5 pt-1">
            <span className="text-xs font-semibold text-neutral-900 block">
              Inquire or Reserve Frame:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* WhatsApp Direct Chat */}
              <a
                href={whatsappInquireUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <WhatsAppIcon className="w-4 h-4 text-white shrink-0" />
                <span>Chat on WhatsApp</span>
              </a>

              {/* Instagram DM Inquire */}
              <button
                type="button"
                onClick={() => {
                  onInquireInstagram(item);
                }}
                className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:brightness-110 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Instagram className="w-4 h-4 text-white shrink-0" />
                <span>Ask on Instagram DM</span>
              </button>
            </div>

            {/* Secondary actions: Copy Details and Google Maps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyDetails}
                className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Details Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Copy Name & Code for Inquiry</span>
                  </>
                )}
              </button>

              <a
                href={SHOP_INFO.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                <span>Visit Pur Road Store</span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="bg-neutral-50 px-4 sm:px-6 py-3 border-t border-neutral-100 text-[11px] text-neutral-500 flex items-center justify-between">
          <span>The Shade Store · Bhilwara, Rajasthan</span>
          <span className="font-mono text-neutral-400">{item.itemCode}</span>
        </div>
      </div>
    </div>
  );
};
