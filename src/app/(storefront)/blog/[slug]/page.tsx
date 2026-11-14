import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { getBlogPostBySlug, getAllBlogPosts } from '@/lib/data/blog';
import { BRAND } from '@/lib/constants/brand';
import {
  generateArticleSchema,
  generateBreadcrumbSchema,
} from '@/lib/services/structured-data';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { Calendar, User, Clock, ArrowLeft, ArrowRight, ShieldCheck, Share2 } from 'lucide-react';
import { ShareButton } from '@/components/common/ShareButton';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: 'Article Not Found' };

  return {
    title: `${post.title} | InfiniCharm Journal`,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      images: post.featuredImageUrl ? [post.featuredImageUrl] : [],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Parse and sanitize markdown
  const rawHtml = await marked.parse(post.contentMarkdown);
  const cleanHtml = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'span']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id'],
    },
  });

  const articleJsonLd = generateArticleSchema(post);
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Journal', url: '/blog' },
    { name: post.title, url: `/blog/${post.slug}` },
  ]);

  return (
    <article className="py-12 bg-surface-dim/30 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Container className="max-w-3xl">
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Journal</span>
        </Link>

        {/* Article Header */}
        <header className="space-y-4 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">
            {post.category}
          </span>

          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-primary tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-sm sm:text-base text-muted leading-relaxed">
            {post.summary}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-2 border-y border-border py-3">
            <div className="flex items-center gap-1.5 font-medium text-primary">
              <User className="w-3.5 h-3.5 text-accent" />
              <span>{post.authorName}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>5 min read</span>
            </div>
            <div className="ml-auto">
              <ShareButton
                title={post.title}
                text={post.summary}
                imageUrl={post.featuredImageUrl}
                variant="subtle"
              />
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImageUrl && (
          <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-surface-dim mb-10 border border-border shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.featuredImageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Body Content */}
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-10 shadow-sm">
          <div
            className="prose prose-neutral max-w-none text-xs sm:text-sm text-primary leading-relaxed space-y-4 font-normal"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />

          {/* Share Article Action Bar */}
          <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-primary">Found this journal dispatch informative?</h4>
              <p className="text-[11px] text-muted">Share with conscious consumers and friends seeking authentic Indian origin goods.</p>
            </div>
            <ShareButton
              title={post.title}
              text={`${post.title} — InfiniCharm Journal`}
              imageUrl={post.featuredImageUrl}
              variant="button"
            />
          </div>

          {/* Sourcing Transparency Box */}
          <div className="mt-8 p-6 bg-surface-dim rounded-2xl border border-border flex items-start gap-3 text-xs text-muted">
            <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <strong className="text-primary block font-semibold mb-0.5">Editorial Guarantee</strong>
              InfiniCharm publishing ethics strictly mandate chemical accuracy, food safety compliance with FSSAI regulations, and truthful origin disclosures.
            </div>
          </div>
        </div>

        {/* Author Bio Card */}
        <div className="mt-10 bg-surface rounded-3xl border border-border p-6 sm:p-8 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
            A
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="font-display text-sm font-bold text-primary">
              {post.authorName}
            </h3>
            <p className="text-muted leading-relaxed">
              Founder & CEO at InfiniCharm (Operated by {BRAND.operatingEntity}). Dedicated to reviving traditional cold-pressing, unadulterated forest honey, and authentic natural Indian goods.
            </p>
            <a
              href={BRAND.founderWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-semibold inline-block pt-1"
            >
              Learn more about AbdurRahman →
            </a>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center p-8 bg-surface rounded-3xl border border-border">
          <h3 className="font-display text-lg font-bold text-primary">Ready to experience pure essentials?</h3>
          <p className="text-xs text-muted mt-2 max-w-md mx-auto mb-5">
            Discover 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, and Premium Dates crafted with utmost care.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-md"
          >
            <span>Explore All Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Container>
    </article>
  );
}

