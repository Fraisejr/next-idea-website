import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy - Next Idea',
  description: 'Privacy Policy for Next Idea application.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-24 sm:px-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-gray-500 italic">Last updated: May 11, 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">1. Introduction</h2>
            <p className="text-gray-600 leading-relaxed">
              Welcome to Next Idea ("we," "our," or "us"). We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy outlines how we collect, use, and protect your information when you use our web application.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">2. Information We Collect</h2>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-800">2.1 Personal Information</h3>
              <p className="text-gray-600 leading-relaxed">
                When you sign in to Next Idea, we may collect information provided by your authentication provider (such as Google or Apple), including your name and email address.
              </p>
            </div>
            <div className="space-y-2 text-blue-900 bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h3 className="text-xl font-semibold">2.2 Google User Data</h3>
              <p className="leading-relaxed">
                If you choose to connect your Google Calendar, we request access to your calendar data using the <code>https://www.googleapis.com/auth/calendar.readonly</code> scope.
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>What we access:</strong> We only read your calendar list and event details (titles, times, and colors).</li>
                <li><strong>How we use it:</strong> This data is used exclusively to display your upcoming events within the "Today" view of the Next Idea app to help you plan your day.</li>
                <li><strong>Storage:</strong> We do not store your Google Calendar data on our own servers. It is fetched directly from Google's APIs and may be temporarily cached in your browser or stored in your private Apple CloudKit database for synchronization across your own devices.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">3. Data Storage and Security</h2>
            <p className="text-gray-600 leading-relaxed">
              Your task data and preferences are stored in <strong>Apple CloudKit</strong>. This means your data is stored in your own private database within Apple's infrastructure, tied to your Apple ID. We do not have access to your private CloudKit data; only you can access it through the application.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We implement industry-standard security measures to protect your information from unauthorized access, alteration, or disclosure.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">4. Data Sharing</h2>
            <p className="text-gray-600 leading-relaxed">
              We do not sell, trade, or otherwise transfer your personal information or Google User Data to third parties. Your data is used solely for providing and improving the service to you.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">5. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Access and review the personal information we hold about you.</li>
              <li>Request the deletion of your account and associated data.</li>
              <li>Disconnect your Google Calendar at any time through the Settings menu.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">6. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
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
