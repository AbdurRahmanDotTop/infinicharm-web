import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { getAllBlogPosts } from '@/lib/data/blog';
import { BRAND } from '@/lib/constants/brand';
import { Calendar, User, Clock, ArrowRight, BookOpen, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Journal & Sourcing Guides | InfiniCharm',
  description: 'In-depth articles, quality standards, storage guides, and sourcing stories for 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, Barliva, and Premium Dates.',
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="py-12 bg-surface-dim/40 min-h-screen">
      <Container>
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full">
            Knowledge & Sourcing Truth
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary mt-4 tracking-tight">
            The InfiniCharm Journal
          </h1>
          <p className="text-sm text-muted mt-3">
            Evidence-based guides, food chemistry disclosures, and stories behind traditional Indian artisan extraction.
          </p>
        </div>

        {/* Featured Top Post */}
        {posts[0] && (
          <div className="mb-12 bg-surface rounded-3xl border border-border overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 group">
            <div className="lg:col-span-7 min-w-0 w-full relative aspect-video lg:aspect-auto lg:min-h-[280px] bg-surface-dim overflow-hidden">
              {posts[0].featuredImageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={posts[0].featuredImageUrl}
                  alt={posts[0].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
              <span className="absolute top-4 left-4 bg-primary text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                Featured Insight
              </span>
            </div>

            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="font-semibold text-accent uppercase tracking-wider">{posts[0].category}</span>
                  <span>•</span>
                  <span>5 min read</span>
                </div>

                <h2 className="font-display text-xl sm:text-2xl font-bold text-primary tracking-tight leading-snug">
                  <Link href={`/blog/${posts[0].slug}`} className="hover:text-accent transition-colors">
                    {posts[0].title}
                  </Link>
                </h2>

                <p className="text-xs sm:text-sm text-muted line-clamp-3 leading-relaxed">
                  {posts[0].summary}
                </p>
              </div>

              <div className="pt-6 border-t border-border mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <User className="w-3.5 h-3.5 text-accent" />
                  <span>{posts[0].authorName}</span>
                </div>

                <Link
                  href={`/blog/${posts[0].slug}`}
                  className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  <span>Read Article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Secondary Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.slice(1).map((post) => (
            <article
              key={post.id}
              className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm flex flex-col justify-between group hover:border-accent/40 transition-all"
            >
              <div>
                <div className="relative aspect-video w-full bg-surface-dim overflow-hidden border-b border-border">
                  {post.featuredImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={post.featuredImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-primary text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {post.category}
                  </span>
                </div>

                <div className="p-6 space-y-2.5">
                  <h3 className="font-display text-lg font-bold text-primary tracking-tight line-clamp-2 leading-snug">
                    <Link href={`/blog/${post.slug}`} className="hover:text-accent transition-colors">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="text-xs text-muted line-clamp-3 leading-relaxed">
                    {post.summary}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0">
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
                  <span className="truncate max-w-[120px]">{post.authorName}</span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </div>
  );
}

