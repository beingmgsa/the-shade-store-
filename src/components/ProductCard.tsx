import React, { useState } from 'react';
import { Instagram, Copy, Check, Eye } from 'lucide-react';
import { GlassesItem } from '../data/glassesCatalog';

interface ProductCardProps {
  item: GlassesItem;
  onInquire: (item: GlassesItem) => void;
  onSelect?: (item: GlassesItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ item, onInquire, onSelect }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copiedOnly, setCopiedOnly] = useState(false);

  const formattedPrice = item.price !== null 
    ? `₹${item.price.toLocaleString('en-IN')}` 
    : 'Price on request';

  const defaultMessage = `Hi The Shade Store! I'm interested in the "${item.name}"${item.price ? ` (${formattedPrice})` : ''} from your catalog. Is this frame available in store?`;

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

  const handleCopyOnly = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(defaultMessage);
    setCopiedOnly(true);
    setTimeout(() => setCopiedOnly(false), 2200);
  };

  const handleInquireClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInquire(item);
  };

  const handleCardClick = () => {
    onSelect?.(item);
  };

  return (
    <article 
      onClick={handleCardClick}
      className="group bg-white rounded-xl overflow-hidden border border-neutral-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col justify-between w-full h-full cursor-pointer hover:border-neutral-400/90"
      title="Tap to see product information and details"
    >
      {/* Product Image Area - Uniform 4:3 Aspect Ratio */}
      <div className="relative aspect-[4/3] w-full bg-[#F5F4F0] overflow-hidden shrink-0">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 animate-pulse bg-neutral-200/50" />
        )}
        
        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-neutral-400 bg-neutral-100">
            <span className="font-serif text-xs sm:text-sm text-neutral-600 line-clamp-1">{item.name}</span>
            <span className="text-[10px] text-neutral-400 mt-0.5">Photo unavailable</span>
          </div>
        ) : (
          <img
            src={item.image}
            alt={item.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover object-center transition-transform duration-300 ease-out sm:group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Hover / Tap overlay indicator */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-950/85 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Eye className="w-3 h-3" />
            <span>View Details</span>
          </span>
        </div>

        {/* Item Reference Code Badge */}
        {item.itemCode && (
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium tracking-wide text-neutral-700 border border-neutral-200/70 shadow-2xs pointer-events-none">
            {item.itemCode}
          </div>
        )}
      </div>

      {/* Product Details & Actions */}
      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col justify-between gap-2.5">
        {/* Title and Price */}
        <div className="flex flex-col">
          <h3 
            className="font-serif text-[13px] sm:text-base font-medium text-neutral-900 group-hover:text-neutral-950 leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.4rem] break-words"
            title={item.name}
          >
            {item.name}
          </h3>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-neutral-800 tabular-nums">
            {formattedPrice}
          </p>
          <span className="mt-1 text-[10px] text-neutral-400 group-hover:text-neutral-600 transition-colors flex items-center gap-1">
            <span>Tap for details & specs</span>
            <span>→</span>
          </span>
        </div>

        {/* Compact Action Buttons */}
        <div className="pt-2 border-t border-neutral-100 flex flex-col gap-1.5 shrink-0">
          {/* Primary Ask on Instagram Button */}
          <button
            onClick={handleInquireClick}
            className="w-full min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white rounded-lg text-[11px] sm:text-xs font-medium transition-colors shadow-2xs active:scale-[0.99] cursor-pointer"
            title="Copies message & opens Instagram DM"
            type="button"
          >
            <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span className="font-medium whitespace-nowrap hidden min-[360px]:inline">Ask on Instagram</span>
            <span className="font-medium whitespace-nowrap min-[360px]:hidden">Ask on IG</span>
          </button>

          {/* Quick Copy Link Helper */}
          <button
            onClick={handleCopyOnly}
            type="button"
            className="w-full min-h-[26px] py-0.5 inline-flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/80 active:bg-neutral-100 rounded transition-colors cursor-pointer"
            title="Copy pre-written message to paste in Instagram DM"
          >
            {copiedOnly ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 font-medium">Copied for DM!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-neutral-400 shrink-0" />
                <span className="hidden min-[360px]:inline">Copy text for DM</span>
                <span className="min-[360px]:hidden">Copy for DM</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
