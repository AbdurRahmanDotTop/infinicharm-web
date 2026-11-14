import { redirect } from 'next/navigation';

export default async function JournalSlugRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/blog/${slug}`);
}

