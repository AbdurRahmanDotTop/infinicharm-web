import React from 'react';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-canvas text-primary outline-none">
      {children}
    </div>
  );
}

