import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Next Idea support" };

export default function SupportPage() {
  return <><Navbar /><main id="main-content" className="document-page"><p className="eyebrow">Inspiraeon SL / Support</p><h1>Next Idea support</h1><p>Have a question, feedback, or need help with Next Idea? Get in touch and we’ll do our best to help.</p><a className="contact-email" href="mailto:next-idea@outlook.com">next-idea@outlook.com ↗</a><h2>Getting started</h2><p>Our <a href="/tutorials">app guides</a> explain how to capture tasks, organize projects, and plan your next steps.</p></main><Footer /></>;
}
