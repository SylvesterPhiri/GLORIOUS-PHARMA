import type { Metadata } from 'next';
import AIFloatingChat from '@/components/AI/AIFloatingChat';
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
        {children}
        <AIFloatingChat />
      </body>
    </html>
  );
}
