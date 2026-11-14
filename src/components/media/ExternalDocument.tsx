'use client';

import React, { useState } from 'react';
import { FileText, FileCheck, ExternalLink, ShieldCheck } from 'lucide-react';
import { GoogleDriveAdapter } from '@/lib/media/providers';

interface ExternalDocumentProps {
  url: string;
  title?: string;
  caption?: string;
  isCertificate?: boolean;
  className?: string;
}

/**
 * InfiniCharm External Document Viewer
 * Complies with MediaUses.md Sections 6.1.C and 11.5.
 * Normalizes Google Drive PDFs, lab certificates, and provides direct view links.
 */
export const ExternalDocument: React.FC<ExternalDocumentProps> = ({
  url,
  title = 'Product Specification Document',
  caption = 'Official batch certificate & purity documentation.',
  isCertificate = true,
  className = '',
}) => {
  const [showPreview, setShowPreview] = useState(false);

  if (!url) return null;

  const isGoogleDrive = url.includes('drive.google.com') || url.includes('docs.google.com');
  const normalized = isGoogleDrive ? GoogleDriveAdapter.normalize(url) : null;
  const previewUrl = normalized?.embedUrl || url;
  const viewUrl = normalized?.sourceUrl || url;

  return (
    <div
      className={`w-full rounded-2xl border border-stone-200 dark:border-stone-800 bg-surface-dim/80 p-5 flex flex-col justify-between overflow-hidden shadow-sm ${className}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isCertificate
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-amber-500/10 text-amber-600'
          }`}
        >
          {isCertificate ? (
            <FileCheck className="w-6 h-6" />
          ) : (
            <FileText className="w-6 h-6" />
          )}
        </div>

        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-primary truncate">
              {title}
            </span>
            {isCertificate && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted leading-relaxed line-clamp-2">{caption}</p>
        </div>
      </div>

      {/* Optional Embedded Iframe Preview */}
      {showPreview && isGoogleDrive && (
        <div className="mt-4 relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-border bg-stone-900">
          <iframe
            src={previewUrl}
            title={title}
            loading="lazy"
            className="w-full h-full border-0"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between gap-3 text-xs">
        {isGoogleDrive && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="font-medium text-accent hover:underline text-xs"
          >
            {showPreview ? 'Hide Inline Preview' : 'Show Inline Preview'}
          </button>
        )}

        <a
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
        >
          <span>{isCertificate ? 'Open Lab Report (PDF)' : 'Open in Google Drive'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

