import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Nigehbaan | Flood-response prioritization",
  description: "Find who needs help most during floods and match scarce rescue resources to them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <Nav />
        {children}
      </body>
    </html>
  );
}
