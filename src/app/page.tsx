import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="company-main">
        <section className="company-hero" aria-labelledby="intro-title">
          <p className="eyebrow">Inspiraeon SL · Consulting &amp; software</p>
          <h1 id="intro-title">A clearer direction.<br /><span>A better way to work.</span></h1>
          <p className="intro">We help businesses make considered decisions, simplify their operations, and build useful digital tools.</p>
          <a className="button" href="#services">Explore our services <span aria-hidden="true">↓</span></a>
          <div className="hero-note"><span className="status-dot" /> Independent advice. Practical delivery.</div>
        </section>

        <section id="about" className="company-section about-section" aria-labelledby="about-title">
          <p className="eyebrow">01 / The company</p>
          <div>
            <h2 id="about-title">A clear perspective.<br />A practical approach.</h2>
            <p>Inspiraeon SL is a small, independent consultancy bringing together business thinking and software development.</p>
            <p>We work with organisations to clarify priorities, improve how work gets done, and turn plans into practical solutions. Our services include management consulting, business process automation with AI agents, and the development of iOS apps and Microsoft Power Apps.</p>
          </div>
        </section>

        <section id="services" className="company-section" aria-labelledby="services-title">
          <div className="section-heading"><p className="eyebrow">02 / What we do</p><h2 id="services-title">From decisions to delivery.</h2></div>
          <div className="services-grid">
            <article className="service-card">
              <p className="eyebrow">Management consulting</p>
              <h3>Make the next move clear.</h3>
              <p>Advice on priorities, ways of working, and organisational change. We help you understand the challenges, weigh the options, and shape a plan you can put into practice.</p>
            </article>
            <article className="service-card">
              <p className="eyebrow">Business process automation</p>
              <h3>Give routine work less time.</h3>
              <p>AI agents that carry out defined steps, connect information, and reduce repetitive work. We design workflows with clear responsibilities and human review where it matters.</p>
            </article>
            <article className="service-card">
              <p className="eyebrow">iOS apps</p>
              <h3>Useful wherever you are.</h3>
              <p>Purpose-built applications for iPhone and iPad, with focused functionality and considered interfaces. From an early idea to a working product, we keep the experience simple and useful.</p>
            </article>
            <article className="service-card">
              <p className="eyebrow">Microsoft Power Apps</p>
              <h3>A closer fit for your work.</h3>
              <p>Custom business applications built with flexible, low-code tools. We bring everyday tasks, approvals, and information together, connecting with the systems your team already uses.</p>
            </article>
          </div>
        </section>

        <section id="approach" className="company-section contact-section" aria-labelledby="approach-title">
          <div><p className="eyebrow">03 / Our approach</p><h2 id="approach-title">Start with the work.<br />Build around the people.</h2><p>We begin by understanding the decisions, tasks, and constraints that shape your day. Then we agree on a clear scope, focus on the changes that matter, and work through them in manageable steps.</p><p>Good advice should lead to action. Good software should make that action easier.</p></div>
          <dl className="company-details"><div><dt>Company</dt><dd>Inspiraeon SL</dd></div><div><dt>Services</dt><dd>Management consulting, business process automation, iOS apps, and Microsoft Power Apps</dd></div><div><dt>Focus</dt><dd>Clear decisions. Simpler operations. Useful tools.</dd></div></dl>
        </section>
      </main>
      <Footer />
    </>
  );
}
