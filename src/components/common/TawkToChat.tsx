'use client';

// ==============================================================================
// InfiniCharm — Official Tawk.to Live Customer Care Widget
// Authoritative Property: 6ae76c24e068a73c41821c1f / Widget: 1k6bvsse1
// Features: Resilient SDK Injection, Zero UI Overlap, Responsive Bottom Clearance
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useCart } from '@/lib/context/CartContext';

declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void;
      minimize?: () => void;
      toggle?: () => void;
      popup?: () => void;
      showWidget?: () => void;
      hideWidget?: () => void;
      onLoad?: () => void;
      onChatStarted?: () => void;
      [key: string]: any;
    };
    Tawk_LoadStart?: Date;
  }
}

export function TawkToChat({ docked = false }: { docked?: boolean } = {}) {
  const { totalItemsCount } = useCart();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const propertyId =
    process.env.NEXT_PUBLIC_TAWKTO_PROPERTY_ID || '6ae76c24e068a73c41821c1f';
  const widgetId = process.env.NEXT_PUBLIC_TAWKTO_WIDGET_ID || '1k6bvsse1';
  const directChatUrl = `https://tawk.to/chat/${propertyId}/${widgetId}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if script is already present
    if (document.getElementById('tawkto-script')) {
      setIsLoaded(true);
      return;
    }

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    // Function to suppress Tawk.to's default floating bubble & attention grabber
    const suppressDefaultBubble = () => {
      try {
        if (typeof window.Tawk_API?.hideWidget === 'function') {
          window.Tawk_API.hideWidget();
        }
      } catch {}
      document.querySelectorAll('iframe').forEach((el) => {
        const style = el.getAttribute('style') || '';
        if (
          style.includes('64px') ||
          style.includes('124px') ||
          style.includes('60px') ||
          style.includes('95px')
        ) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      });
    };

    // Inject override stylesheet to guarantee default floating bubbles stay hidden
    if (!document.getElementById('tawkto-suppress-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'tawkto-suppress-style';
      styleEl.innerHTML = `
        iframe[style*="max-width: 64px"],
        iframe[style*="min-width: 64px"],
        iframe[style*="max-width: 124px"],
        iframe[style*="min-width: 124px"],
        iframe[style*="min-height: 60px"],
        iframe[style*="min-height: 95px"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Hide default Tawk.to round icon & bubble so our branded launcher has exclusive control
    window.Tawk_API.onLoad = () => {
      suppressDefaultBubble();
      setIsLoaded(true);
    };

    window.Tawk_API.onChatMinimized = () => {
      suppressDefaultBubble();
      setIsOpen(false);
    };

    window.Tawk_API.onChatHidden = () => {
      suppressDefaultBubble();
      setIsOpen(false);
    };

    window.Tawk_API.onAttentionGrabberShown = () => {
      suppressDefaultBubble();
    };

    // If already loaded from previous page, suppress immediately
    suppressDefaultBubble();

    const s1 = document.createElement('script');
    s1.id = 'tawkto-script';
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s1.charset = 'UTF-8';

    // Error handling if external widget is blocked by ad-blocker or firewall
    s1.onerror = () => {
      // Fallback mode: custom launcher will open direct chat popup
      setIsLoaded(false);
    };

    const s0 = document.getElementsByTagName('script')[0];
    if (s0 && s0.parentNode) {
      s0.parentNode.insertBefore(s1, s0);
    } else {
      document.head.appendChild(s1);
    }

    // Continuous observer to guarantee default floating bubble never re-appears
    const observer = new MutationObserver(() => {
      suppressDefaultBubble();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    const interval = setInterval(suppressDefaultBubble, 500);
    const timeout = setTimeout(() => clearInterval(interval), 6000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [propertyId, widgetId]);

  const handleOpenChat = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.Tawk_API) {
      try {
        if (typeof window.Tawk_API.maximize === 'function') {
          window.Tawk_API.maximize();
          setIsOpen(true);
          return;
        }
        if (typeof window.Tawk_API.toggle === 'function') {
          window.Tawk_API.toggle();
          setIsOpen(true);
          return;
        }
      } catch (err) {
        console.error('Error opening Tawk.to chat:', err);
      }
    }

    // Direct fallback popup window
    const popupWidth = 460;
    const popupHeight = 620;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;
    window.open(
      directChatUrl,
      'InfiniCharmLiveChat',
      `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );
  };

  const bottomPositionClass =
    totalItemsCount > 0
      ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]';

  const containerClass = docked
    ? 'transition-all duration-300 pointer-events-auto'
    : `fixed ${bottomPositionClass} right-4 sm:right-6 z-30 transition-all duration-300 pointer-events-auto`;

  return (
    <div data-testid="live-care-wrapper" className={containerClass}>
      <button
        type="button"
        data-testid="live-care-btn"
        onClick={handleOpenChat}
        className="group relative flex items-center gap-2 h-10 sm:h-11 px-3.5 sm:px-4 rounded-full bg-primary hover:bg-primary-hover text-white shadow-level-2 hover:shadow-level-3 transition-all border border-border/20 focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Open Live Customer Support Chat"
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          {/* Pulsing Green Online Indicator */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <div className="flex flex-col text-left leading-none">
          <span className="text-[8px] sm:text-[9px] text-white/75 uppercase tracking-wider font-mono">
            Online Now
          </span>
          <span className="text-xs font-bold text-white tracking-tight">
            Live Care
          </span>
        </div>
      </button>
    </div>
  );
}

export default TawkToChat;
