import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Website information" };

export default function WebsiteInformation() {
  return (
    <><Navbar /><main id="main-content" className="document-page">
      <p className="eyebrow">Inspiraeon SL / Website information</p>
      <h1>Website information</h1>
      <p>This website is operated by Inspiraeon SL and presents the company’s consulting services and iOS app development work.</p>
      <h2>About this website</h2>
      <p>The information on this website provides a general introduction to our activities. It does not offer online purchasing or account registration.</p>
      <h2>Company</h2>
      <p>Inspiraeon SL</p>
    </main><Footer /></>
  );
}
