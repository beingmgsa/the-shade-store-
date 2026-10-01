/**
 * Client-side image compression and resizing utility.
 * Optimizes photos taken from smartphones (often 5MB - 20MB)
 * down to crisp, web-optimized JPEG images (< 350KB) before uploading to Cloudinary.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
}

export async function compressProductImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1400,
    maxHeight = 1400,
    quality = 0.85,
  } = options;

  // If it's not an image (or is SVG / GIF that shouldn't be canvas compressed), return original
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // If already under 250KB and a standard web format, no need to re-encode
  if (file.size <= 250 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Keep aspect ratio intact
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original file if canvas context is unavailable
          resolve(file);
          return;
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to JPEG blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Create clean compressed file retaining base name
            const originalName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], `${originalName}_optimized.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            // If compressed is unexpectedly larger than original, use original
            if (compressedFile.size > file.size) {
              resolve(file);
            } else {
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
