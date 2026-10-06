import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inspiraeon SL — Consulting & iOS app development", template: "%s | Inspiraeon SL" },
  description: "Inspiraeon SL offers consulting services and builds native iOS applications, with a focus on clear thinking and thoughtful software.",
  openGraph: { title: "Inspiraeon SL", description: "Consulting services and native iOS app development.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
