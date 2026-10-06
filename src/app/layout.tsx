import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inspiraeon SL — Thoughtful apps for everyday life", template: "%s | Inspiraeon SL" },
  description: "Inspiraeon SL creates native software for Apple platforms. Discover Next Idea and contact the company.",
  openGraph: { title: "Inspiraeon SL", description: "Thoughtful apps for everyday life. The company behind Next Idea.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
