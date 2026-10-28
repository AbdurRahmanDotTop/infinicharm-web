/**
 * Create a public Cloudinary delivery URL for an uploaded image.
 * Cloud name and public IDs are not secrets. Never put the API secret in frontend code.
 */
export function productImageUrl(publicId?: string, width = 900): string {
  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();

  // A local placeholder keeps the site usable before a Cloudinary account is configured.
  if (!cloudName || !publicId) {
    return '/images/product-placeholder.svg';
  }

  const safePublicId = publicId.split('/').map(encodeURIComponent).join('/');
  const safeWidth = Math.min(1800, Math.max(240, Math.round(width)));
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/f_auto,q_auto,w_${safeWidth},c_limit/${safePublicId}`;
}
