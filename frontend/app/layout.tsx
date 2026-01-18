import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Cal Poly Risk Assessment Tool",
  description: "Enterprise Risk Management platform for Cal Poly",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      "calpoly-green": "#003831",
                      "calpoly-gold": "#B29A6C",
                      "risk-high": "#ef4444",
                      "risk-medium": "#f97316",
                      "risk-low": "#22c55e",
                    },
                  },
                },
              };
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

