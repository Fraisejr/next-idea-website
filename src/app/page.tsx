import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="company-main">
        <section className="company-hero" aria-labelledby="intro-title">
          <p className="eyebrow">Inspiraeon SL · Independent software</p>
          <h1 id="intro-title">A little more clarity.<br /><span>A lot more possibility.</span></h1>
          <p className="intro">We create thoughtful apps that help you make space for your ideas and move forward with what matters.</p>
          <a className="button" href="#apps">Explore our app <span aria-hidden="true">↗</span></a>
          <div className="hero-note"><span className="status-dot" /> Built with care for Apple devices.</div>
        </section>

        <section id="about" className="company-section about-section" aria-labelledby="about-title">
          <p className="eyebrow">01 / The company</p>
          <div>
            <h2 id="about-title">Thoughtful software.<br />Everyday purpose.</h2>
            <p>Inspiraeon SL is the company behind Next Idea. Our focus is simple: creating useful, considered software for everyday life.</p>
            <p>We build native apps for Apple platforms, with an emphasis on clear design and helping people organize their ideas, projects, and next steps.</p>
          </div>
        </section>

        <section id="apps" className="company-section" aria-labelledby="apps-title">
          <div className="section-heading"><p className="eyebrow">02 / Our app</p><h2 id="apps-title">Meet Next Idea.</h2></div>
          <article className="app-card">
            <div className="app-icon"><Image src="/logo.png" alt="Next Idea app icon" width={96} height={96} /></div>
            <div className="app-description"><p className="eyebrow">iPhone · iPad · Mac</p><h3>Room for your next idea.</h3><p>Capture your thoughts, organize your projects, and decide what to do next. Next Idea helps you bring a little order to a busy day.</p><div className="app-links"><a className="button" href="https://apps.apple.com/es/app/next-idea/id6448846931?l=en-GB" target="_blank" rel="noopener noreferrer">View on the App Store <span aria-hidden="true">↗</span></a><a className="text-link" href="/tutorials">App guides <span aria-hidden="true">→</span></a></div></div>
          </article>
        </section>

        <section id="contact" className="company-section contact-section" aria-labelledby="contact-title">
          <div><p className="eyebrow">03 / Get in touch</p><h2 id="contact-title">Let’s talk.</h2><p>For company enquiries, questions about Next Idea, or app support, contact us by email.</p><a className="contact-email" href="mailto:next-idea@outlook.com">next-idea@outlook.com <span aria-hidden="true">↗</span></a></div>
          <dl className="company-details"><div><dt>Company</dt><dd>Inspiraeon SL</dd></div><div><dt>What we do</dt><dd>Software development for Apple platforms</dd></div><div><dt>Our product</dt><dd>Next Idea</dd></div></dl>
        </section>
      </main>
      <Footer />
    </>
  );
}
