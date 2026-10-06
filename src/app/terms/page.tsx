import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Website information" };

export default function WebsiteInformation() {
  return <><Navbar /><main id="main-content" className="document-page"><p className="eyebrow">Inspiraeon SL / Website information</p><h1>Website information</h1><p>This website is operated by Inspiraeon SL and presents the company and its software, including Next Idea.</p><h2>Contact</h2><p>For company enquiries or app support, email <a href="mailto:next-idea@outlook.com">next-idea@outlook.com</a>.</p><h2>App information</h2><p>Next Idea is a native app distributed through Apple’s App Store. See its App Store listing for current availability, pricing, and applicable app terms.</p><h2>External links</h2><p>Links to the App Store take you to a service operated by Apple, which has its own terms and privacy information.</p></main><Footer /></>;
}
