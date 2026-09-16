import type { Metadata } from "next";
import "./globals.css";
import "./planner.css";

export const metadata: Metadata = {
  title: "A la mesa · Dani y Marta",
  description: "Nuestro menú mensual de comidas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
