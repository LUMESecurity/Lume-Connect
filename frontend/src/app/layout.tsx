import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravLume Connect - Super Admin",
  description: "Enterprise Super Admin Portal for TravLume Connect",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="stylesheet" href="/tailwind.css?v=4" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#D2B68D] selection:text-[#242D53]">
        {children}
      </body>
    </html>
  );
}
