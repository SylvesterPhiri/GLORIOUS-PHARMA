import type { Metadata } from 'next';
import AIFloatingChat from '@/components/AI/AIFloatingChat';
import MobileNav from '@/components/MobileNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Glorious Pharma',
  description: 'Pharmaceutical Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Bottom padding on mobile so content isn't hidden behind the nav bar */}
        <div className="pb-16 md:pb-0">
          {children}
        </div>
        <MobileNav />
        <AIFloatingChat />
      </body>
    </html>
  );
}
