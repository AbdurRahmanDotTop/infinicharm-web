export interface Product {
  slug: string;
  name: string;
  category: 'Accessories' | 'Electronics' | 'Home';
  price: number;
  shortDescription: string;
  description: string;
  badge?: string;
  /** Public ID copied from your own Cloudinary Media Library after you upload an image. */
  imagePublicId?: string;
}

// These are fictional demo products, not real offers or inventory. Replace them before launch.
export const products: Product[] = [
  {
    slug: 'our-creation-of-ameer-al-oud-perfume',
    name: 'Our Creation of Ameer Al Oud Perfume',
    category: 'Accessories',
    price: 1499,
    shortDescription: 'Bossy is a fresh and confident fragrance that blends fruity and ozonic notes with green florals, finishing on a smooth base of sandalwood, musk, and moss.',
    description: 'Bold, refreshing, and effortlessly sophisticated, Bossy opens with a vibrant fusion of fresh, fruity, and ozonic notes that create an energizing first impression. The heart reveals a refined blend of green accords, rose, and jasmine, adding depth and elegance. As the fragrance settles, sandalwood, musk, and moss create a smooth, earthy finish that lingers with confidence and character. Modern and versatile, Bossy is crafted for those who lead with style and leave a lasting impression.',
    badge: 'Featured',
    imagePublicId: 'bestAttarBottle_1_FrontImg'
  },
  {
    slug: 'halo-wireless-headphones',
    name: 'Halo Wireless Headphones',
    category: 'Electronics',
    price: 3499,
    shortDescription: 'Comfort-focused audio for work, travel, and downtime.',
    description: 'A sample electronics listing for testing the product page. Confirm compatibility, warranty, included accessories, and genuine product information before publishing.'
  },
  {
    slug: 'cloud-knit-sneakers',
    name: 'Cloud Knit Sneakers',
    category: 'Accessories',
    price: 2799,
    shortDescription: 'A lightweight-looking everyday sneaker concept.',
    description: 'This placeholder listing demonstrates descriptions and pricing. Replace the image, available sizes, color choices, material details, and stock levels before launch.',
    badge: 'New'
  },
  {
    slug: 'solstice-ceramic-set',
    name: 'Solstice Ceramic Set',
    category: 'Home',
    price: 1199,
    shortDescription: 'A minimal tableware concept for a calm home.',
    description: 'A fictional homeware product used only to test catalogue layouts. Add exact pieces per set, dimensions, care instructions, and delivery constraints before using a real listing.'
  },
  {
    slug: 'ember-desk-lamp',
    name: 'Ember Desk Lamp',
    category: 'Home',
    price: 1899,
    shortDescription: 'A clean desk-lighting concept for focused spaces.',
    description: 'A sample listing for the web prototype. A real listing needs verified electrical specifications, supported voltage, safety certifications where applicable, and warranty information.'
  },
  {
    slug: 'nova-smart-watch',
    name: 'Nova Smart Watch',
    category: 'Electronics',
    price: 4499,
    shortDescription: 'A wearable-tech concept with a modern silhouette.',
    description: 'This fictional product helps demonstrate the product-detail template. Replace all specifications, compatibility claims, photos, and inventory data with verified information.',
    badge: 'Popular'
  }
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
