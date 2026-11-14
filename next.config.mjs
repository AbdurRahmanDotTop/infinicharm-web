/** @type {import('next').NextConfig} */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.tawk.to https://*.tawk.to https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://embed.tawk.to https://*.tawk.to https://fonts.googleapis.com https://cdn.jsdelivr.net;
  img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://plus.unsplash.com https://*.unsplash.com https://unsplash.com https://*.tawk.to https://tawk.to https://via.placeholder.com https://lh3.googleusercontent.com https://blogger.googleusercontent.com https://*.googleusercontent.com https://*.blogger.com https://*.blogspot.com https://bp.blogspot.com https://ik.imagekit.io https://*.imagekit.io https://res.cloudinary.com https://*.cloudinary.com https://img.youtube.com https://i.ytimg.com https://drive.google.com https://encrypted-tbn0.gstatic.com https://*.gstatic.com https://rukminim2.flixcart.com https://*.flixcart.com https://zamzamstoreeg.com https://*.zamzamstoreeg.com https://cdn.jsdelivr.net https://*.payglocal.in https://assets.payglocal.in;
  font-src 'self' data: https://embed.tawk.to https://*.tawk.to https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co https://*.tawk.to wss://*.tawk.to https://cdn.jsdelivr.net https://*.payglocal.in https://api.payglocal.in https://api.uat.payglocal.in;
  media-src 'self' blob: https:;
  frame-src 'self' https://*.tawk.to https://tawk.to https://www.youtube-nocookie.com https://www.youtube.com https://youtube.com https://drive.google.com https://docs.google.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ziafauuodnmktzmsjpka.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'zamzamstoreeg.com',
      },
      {
        protocol: 'https',
        hostname: 'rukminim2.flixcart.com',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: '*.payglocal.in',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'blogger.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: '*.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/story',
        destination: '/about',
        permanent: true,
      },
      {
        source: '/deals',
        destination: '/shop?filter=deals',
        permanent: false,
      },
      {
        source: '/journal',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/journal/:slug',
        destination: '/blog/:slug',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
