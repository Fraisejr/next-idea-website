import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inspiraeon SL — Business consulting & software", template: "%s | Inspiraeon SL" },
  description: "Inspiraeon SL provides management consulting, business process automation with AI agents, and development of iOS apps and Microsoft Power Apps.",
  openGraph: { title: "Inspiraeon SL", description: "Management consulting, business process automation with AI agents, iOS apps, and Microsoft Power Apps.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
