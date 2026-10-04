/**
 * THE SHADE STORE - PRODUCT CATALOG CONFIGURATION
 * 
 * Shop Owner Guide:
 * To add, edit, or remove glasses:
 * 1. Modify the items in the `catalog` array below.
 * 2. Set `name` to your frame name.
 * 3. Set `price` to a number (e.g., 1899) or `null` if you want to display "Price on inquiry".
 * 4. Set `image` to your image file path or URL.
 */

// Import generated studio product images
import heroImage from '@/src/assets/images/hero_eyewear_1790681723782.jpg';
import tortoiseAcetate from '@/src/assets/images/glasses_tortoise_acetate_1790681743897.jpg';
import matteBlack from '@/src/assets/images/glasses_matte_black_square_1790681762010.jpg';
import goldGeometric from '@/src/assets/images/glasses_gold_geometric_1790681777666.jpg';
import minimalistTitanium from '@/src/assets/images/glasses_minimalist_titanium_1790681791906.jpg';

export interface GlassesItem {
  id: string;
  name: string;
  price: number | null; // Price in INR (₹) or null if unlisted
  image: string; // Primary image
  images?: string[]; // Multiple photos gallery
  itemCode?: string; // Optional tag or model code for customer reference
  description?: string; // Specifications, fit, and frame details
  available?: boolean;
}

export const SHOP_INFO = {
  name: "The Shade Store",
  phone: "+91 63752 15151",
  whatsappUrl: "https://wa.me/916375215151",
  instagramHandle: "@theshadestore.in",
  instagramUrl: "https://www.instagram.com/theshadestore.in/",
  address: "Pur Road, near Sanganeri Gate, Bhilwara, Rajasthan 311001, India",
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Pur+Road+near+Sanganeri+Gate+Bhilwara+Rajasthan+311001+India",
  heroImage: heroImage,
};

export const GLASSES_CATALOG: GlassesItem[] = [
  {
    id: "frame-01",
    name: "Classic Amber Tortoise Frame",
    price: 1899,
    image: tortoiseAcetate,
    itemCode: "TSS-01",
    description: "Premium handcrafted tortoise shell acetate frame with smooth spring hinges and comfortable nose bridge. Compatible with progressive and blue-light filter lenses.",
    available: true,
  },
  {
    id: "frame-02",
    name: "Matte Black Sculpted Square",
    price: 1699,
    image: matteBlack,
    itemCode: "TSS-02",
    description: "Modern architectural square silhouette with velvety matte black finish. Ultra-durable daily driver with reinforced core temples.",
    available: true,
  },
  {
    id: "frame-03",
    name: "Brushed Gold Geometric Hexagonal",
    price: 2199,
    image: goldGeometric,
    itemCode: "TSS-03",
    description: "Distinctive geometric hexagonal rims crafted from lightweight brushed gold alloy with clear acetate temple tips.",
    available: true,
  },
  {
    id: "frame-04",
    name: "Minimalist Titanium Round Wire",
    price: 2499,
    image: minimalistTitanium,
    itemCode: "TSS-04",
    description: "Featherlight titanium round wire frame with hypoallergenic silicone nose pads and flexible high-tensile temples.",
    available: true,
  },
  {
    id: "frame-05",
    name: "Vintage Havana Rounded Acetate",
    price: 1999,
    image: tortoiseAcetate,
    itemCode: "TSS-05",
    description: "Timeless Havana brown optical frame with retro keyhole bridge and polished dual-rivet accents.",
    available: true,
  },
  {
    id: "frame-06",
    name: "Modern Architectural Black Optical",
    price: 1599,
    image: matteBlack,
    itemCode: "TSS-06",
    description: "Sleek low-profile black rectangular frame suitable for single-vision and progressive optical lenses.",
    available: true,
  },
  {
    id: "frame-07",
    name: "Fine Wire Gold Octagonal Frame",
    price: 2299,
    image: goldGeometric,
    itemCode: "TSS-07",
    description: "Delicate polished gold octagonal wire frame offering a sharp, intellectual profile for everyday wear.",
    available: true,
  },
  {
    id: "frame-08",
    name: "Polished Silver Lightweight Round",
    price: 2399,
    image: minimalistTitanium,
    itemCode: "TSS-08",
    description: "Contemporary polished silver round optical frame engineered for supreme comfort and all-day wear.",
    available: true,
  },
];
