import React from 'react';
import type { SocialPlatformKey } from '@/types';
import { Globe, Share2 } from 'lucide-react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function YouTubeIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function FacebookIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function InstagramIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.979-.275-.1-.475-.15-.675.15-.2.301-.775.979-.95 1.18-.175.2-.35.226-.65.076-.3-.15-1.267-.467-2.414-1.489-.893-.797-1.496-1.782-1.672-2.083-.175-.301-.019-.463.132-.613.136-.135.301-.35.451-.526.15-.175.2-.3.301-.5.1-.2.05-.375-.025-.526-.075-.15-.675-1.628-.925-2.232-.244-.588-.492-.508-.675-.518-.175-.008-.375-.01-.575-.01s-.525.075-.8.375c-.275.3-1.05 1.028-1.05 2.507s1.075 2.905 1.225 3.105c.15.2 2.115 3.23 5.123 4.531.716.31 1.275.495 1.71.634.72.228 1.375.196 1.893.119.578-.087 1.78-.727 2.03-1.429.25-.702.25-1.304.175-1.429-.075-.125-.275-.2-.575-.35zM12.04 21.75c-1.748 0-3.46-.46-4.97-1.332l-.356-.206-3.702.97.988-3.608-.228-.363a9.704 9.704 0 0 1-1.488-5.184c0-5.385 4.38-9.768 9.768-9.768 2.607 0 5.06 1.016 6.903 2.86 1.843 1.843 2.859 4.296 2.859 6.904 0 5.386-4.382 9.767-9.772 9.767zm8.307-18.077C18.128 1.455 15.197.35 12.04.35 5.608.35.372 5.586.372 12.02c0 2.055.536 4.062 1.556 5.832L0 24l6.326-1.87c1.702.928 3.626 1.417 5.714 1.417 6.432 0 11.668-5.236 11.668-11.668 0-3.158-1.23-6.09-3.361-8.222z" />
    </svg>
  );
}

export function TwitterXIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function LinkedInIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

export function TheCrumbIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Editorial badge icon representing The Crumb network */}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <circle cx="8" cy="9" r="1" fill="currentColor" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
      <circle cx="10" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

export function renderPlatformIcon(platform: SocialPlatformKey, size = 18, className = '') {
  switch (platform) {
    case 'youtube':
      return <YouTubeIcon size={size} className={className} />;
    case 'facebook':
      return <FacebookIcon size={size} className={className} />;
    case 'instagram':
      return <InstagramIcon size={size} className={className} />;
    case 'whatsapp':
      return <WhatsAppIcon size={size} className={className} />;
    case 'twitter':
      return <TwitterXIcon size={size} className={className} />;
    case 'linkedin':
      return <LinkedInIcon size={size} className={className} />;
    case 'thecrumb':
      return <TheCrumbIcon size={size} className={className} />;
    case 'website':
      return <Globe size={size} className={className} />;
    default:
      return <Share2 size={size} className={className} />;
  }
}

