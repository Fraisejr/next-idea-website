import Link from "next/link";

export default function Navbar() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header"><nav className="site-nav" aria-label="Main navigation">
        <Link className="wordmark" href="/">inspiraeon<span aria-hidden="true">✳</span><span className="sr-only"> SL</span></Link>
        <div className="nav-links"><Link href="/#about">Company</Link><Link href="/#services">Services</Link><Link href="/#approach">Approach</Link></div>
      </nav></header>
    </>
  );
}
