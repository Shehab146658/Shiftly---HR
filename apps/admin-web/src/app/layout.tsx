import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shiftly HR",
  description: "Multi-tenant HR SaaS for multi-branch businesses",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
