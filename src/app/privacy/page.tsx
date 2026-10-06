import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Website privacy" };

export default function PrivacyPage() {
  return <><Navbar /><main id="main-content" className="document-page"><p className="eyebrow">Inspiraeon SL / Privacy</p><h1>Website privacy</h1><p className="updated">Updated 6 October 2026</p><p>This page describes the Inspiraeon SL website. It does not describe data processing within the native Next Idea app.</p><h2>Browsing this website</h2><p>This is an informational website. It has no accounts, sign-in, task storage, or calendar connections. The website code does not use analytics, advertising trackers, or cookies.</p><p>The hosting provider may process technical information, such as IP addresses and request logs, when serving the website.</p><h2>Contact by email</h2><p>If you email us, we receive the email address and information you choose to share, and use them to respond to your enquiry.</p><h2>External services</h2><p>App Store links open Apple’s website. Its own privacy information applies when you visit it. For the native app’s privacy information, consult its App Store listing.</p><h2>Privacy questions</h2><p>Contact Inspiraeon SL at <a href="mailto:next-idea@outlook.com">next-idea@outlook.com</a> with questions about this website or information you have sent us.</p></main><Footer /></>;
}
