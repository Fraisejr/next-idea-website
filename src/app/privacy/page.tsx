import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Website privacy" };

export default function PrivacyPage() {
  return (
    <><Navbar /><main id="main-content" className="document-page">
      <p className="eyebrow">Inspiraeon SL / Privacy</p>
      <h1>Website privacy</h1>
      <p className="updated">Updated 6 October 2026</p>
      <p>This page describes the informational website operated by Inspiraeon SL.</p>
      <h2>Browsing this website</h2>
      <p>The website has no accounts, sign-in, or forms for submitting personal information. The website code does not use analytics, advertising trackers, or cookies.</p>
      <h2>Hosting</h2>
      <p>The hosting provider may process technical information, such as IP addresses and request logs, when serving the website.</p>
      <h2>Scope</h2>
      <p>This page covers this website only. Separate privacy information applies to any applications or services provided by the company.</p>
    </main><Footer /></>
  );
}
