import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms of Service - Next Idea',
  description: 'Terms of Service for Next Idea application.',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-24 sm:px-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-gray-500 italic">Last updated: May 11, 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing or using Next Idea, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">2. Description of Service</h2>
            <p className="text-gray-600 leading-relaxed">
              Next Idea is a productivity application designed to help users organize tasks, projects, and calendars. The service is provided "as is" and "as available."
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">3. User Accounts</h2>
            <p className="text-gray-600 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">4. Third-Party Services</h2>
            <p className="text-gray-600 leading-relaxed">
              Next Idea integrates with third-party services, including Google Calendar and Apple CloudKit. Your use of these services is subject to their respective terms and privacy policies. We are not responsible for the availability or accuracy of such external services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">5. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              To the maximum extent permitted by law, Next Idea and its creator shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">6. Changes to Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to modify these terms at any time. We will provide notice of any significant changes by posting the new terms on this page. Your continued use of the service after such changes constitutes your acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">7. Contact Information</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="font-semibold text-gray-900">
              Email: <a href="mailto:next-idea@outlook.com" className="text-blue-600 hover:underline">next-idea@outlook.com</a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
