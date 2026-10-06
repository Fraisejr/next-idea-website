import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="company-main">
        <section className="company-hero" aria-labelledby="intro-title">
          <p className="eyebrow">Inspiraeon SL · Consulting &amp; software</p>
          <h1 id="intro-title">Clear thinking.<br /><span>Thoughtful software.</span></h1>
          <p className="intro">We offer consulting services and build iOS apps, bringing practical thinking and considered design to digital projects.</p>
          <a className="button" href="#services">Explore our services <span aria-hidden="true">↓</span></a>
          <div className="hero-note"><span className="status-dot" /> From an early idea to a useful product.</div>
        </section>

        <section id="about" className="company-section about-section" aria-labelledby="about-title">
          <p className="eyebrow">01 / The company</p>
          <div>
            <h2 id="about-title">A clear perspective.<br />A practical approach.</h2>
            <p>Inspiraeon SL provides consulting services and develops native applications for iOS.</p>
            <p>We help turn ideas into clear plans and useful software, with a focus on simplicity, usability, and the needs of the people using it.</p>
          </div>
        </section>

        <section id="services" className="company-section" aria-labelledby="services-title">
          <div className="section-heading"><p className="eyebrow">02 / What we do</p><h2 id="services-title">Advice and development.</h2></div>
          <div className="services-grid">
            <article className="service-card">
              <p className="eyebrow">Consulting</p>
              <h3>Clarity before complexity.</h3>
              <p>Practical guidance for digital projects, from exploring an idea and defining priorities to planning the next steps.</p>
            </article>
            <article className="service-card">
              <p className="eyebrow">iOS app development</p>
              <h3>Built around people.</h3>
              <p>Native iOS applications with thoughtful interfaces and focused functionality, designed to feel at home on Apple devices.</p>
            </article>
          </div>
        </section>

        <section id="approach" className="company-section contact-section" aria-labelledby="approach-title">
          <div><p className="eyebrow">03 / Our approach</p><h2 id="approach-title">Make every step count.</h2><p>Understand the problem. Focus on what matters. Build with care. We bring this approach to both our consulting work and our software development.</p></div>
          <dl className="company-details"><div><dt>Company</dt><dd>Inspiraeon SL</dd></div><div><dt>Services</dt><dd>Consulting and iOS app development</dd></div><div><dt>Focus</dt><dd>Clear ideas. Useful software.</dd></div></dl>
        </section>
      </main>
      <Footer />
    </>
  );
}
