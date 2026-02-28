import "./globals.css";
import { ReactNode } from "react";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "Cal Poly Risk Assessment Tool",
  description: "Enterprise Risk Management platform for Cal Poly",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="font-sans antialiased">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      "calpoly-green": "#154734",
                      "calpoly-gold": "#C69214",
                      "risk-high": "#ef4444",
                      "risk-medium": "#f97316",
                      "risk-low": "#22c55e",
                    },
                    fontFamily: {
                      sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
                    },
                  },
                },
              };
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#f8f9fa] text-gray-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

