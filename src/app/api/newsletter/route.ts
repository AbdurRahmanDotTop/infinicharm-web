import { NextResponse } from 'next/server';
import { getNewsletterWidgetSettings } from '@/lib/server/newsletter-store';

export async function GET() {
  const settings = getNewsletterWidgetSettings();
  return NextResponse.json({
    success: true,
    settings: {
      isEnabled: settings.isEnabled,
      badge: settings.badge,
      heading: settings.heading,
      description: settings.description,
      emailPlaceholder: settings.emailPlaceholder,
      buttonText: settings.buttonText,
      loadingText: settings.loadingText,
      successMessage: settings.successMessage,
      alreadySubscribedMessage: settings.alreadySubscribedMessage,
      invalidEmailMessage: settings.invalidEmailMessage,
      errorMessage: settings.errorMessage,
      privacyFootnote: settings.privacyFootnote,
    },
  });
}
