import { redirect } from 'next/navigation';

export default function DealsRedirectPage() {
  redirect('/shop?filter=deals');
}

