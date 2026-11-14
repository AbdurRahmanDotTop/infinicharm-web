'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  Mail,
  ExternalLink,
  Share2,
} from 'lucide-react';
import {
  WhatsAppIcon,
  TwitterXIcon,
  FacebookIcon,
  LinkedInIcon,
} from './SocialIcons';
import type { ShareChannelsConfig } from '@/types';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  text?: string;
  imageUrl?: string;
  subtitle?: string;
  channels?: Partial<ShareChannelsConfig>;
}

export function ShareModal({
  isOpen,
  onClose,
  title,
  url,
  text,
  imageUrl,
  subtitle,
  channels = {
    whatsapp: true,
    twitter: true,
    facebook: true,
    linkedin: true,
    email: true,
    copyLink: true,
  },
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const shareText = text || title;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    if (!hasNativeShare) return;
    try {
      await navigator.share({
        title,
        text: shareText,
        url,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Device share failed:', err);
      }
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const shareLinks = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      enabled: channels.whatsapp !== false,
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\n${url}`)}`,
      icon: <WhatsAppIcon size={22} className="text-white" />,
      bgClass: 'bg-[#25D366] hover:bg-[#20ba59]',
    },
    {
      key: 'twitter',
      label: 'X (Twitter)',
      enabled: channels.twitter !== false,
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      icon: <TwitterXIcon size={18} className="text-white" />,
      bgClass: 'bg-black hover:bg-neutral-800 text-white',
    },
    {
      key: 'facebook',
      label: 'Facebook',
      enabled: channels.facebook !== false,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <FacebookIcon size={20} className="text-white" />,
      bgClass: 'bg-[#1877F2] hover:bg-[#166fe5]',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      enabled: channels.linkedin !== false,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <LinkedInIcon size={18} className="text-white" />,
      bgClass: 'bg-[#0A66C2] hover:bg-[#095196]',
    },
    {
      key: 'email',
      label: 'Email',
      enabled: channels.email !== false,
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(
        `${shareText}\n\nView here: ${url}`
      )}`,
      icon: <Mail className="w-5 h-5 text-white" />,
      bgClass: 'bg-neutral-700 hover:bg-neutral-800',
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-3xl border border-border p-6 sm:p-7 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-scale-in text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/10 text-accent">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="share-modal-title" className="font-display text-base font-bold text-primary">
                Share this with friends
              </h3>
              <p className="text-[11px] text-muted">Spread authentic products & sustainable craft</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-dim text-muted hover:text-primary transition-colors"
            aria-label="Close share dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview Snippet */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-surface-dim border border-border">
          {imageUrl && (
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-surface shrink-0 border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-primary truncate">{title}</h4>
            {subtitle && <p className="text-[11px] text-accent font-medium mt-0.5">{subtitle}</p>}
            <p className="text-[10px] text-muted font-mono truncate mt-0.5">{url}</p>
          </div>
        </div>

        {/* Social Share Buttons Grid */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
            Share via
          </span>
          <div className="grid grid-cols-5 gap-2.5">
            {shareLinks
              .filter((c) => c.enabled)
              .map((channel) => (
                <a
                  key={channel.key}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 group p-2 rounded-xl hover:bg-surface-dim transition-all"
                  title={`Share on ${channel.label}`}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs ${channel.bgClass}`}
                  >
                    {channel.icon}
                  </div>
                  <span className="text-[10px] font-medium text-muted group-hover:text-primary truncate max-w-full">
                    {channel.label.split(' ')[0]}
                  </span>
                </a>
              ))}
          </div>

          {/* More device options if supported */}
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-surface-dim hover:bg-surface border border-border text-[11px] font-semibold text-primary flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-accent" />
              <span>More device sharing options</span>
            </button>
          )}
        </div>

        {/* Copy Link Row */}
        {channels.copyLink !== false && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
              Or copy direct link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 px-3 py-2 bg-surface-dim border border-border rounded-xl text-xs font-mono text-primary focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary hover:bg-primary-hover text-white'
                }`}
                aria-label={copied ? 'Link copied to clipboard' : 'Copy link to clipboard'}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            {copied && (
              <p className="text-[11px] text-emerald-600 font-medium animate-fade-in">
                ✓ Link copied to clipboard! Ready to paste.
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
