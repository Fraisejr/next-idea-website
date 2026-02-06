import { Mail } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function SupportPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 sm:px-12">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Next Idea Support
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-xl mx-auto">
              We&apos;re here to help. If you have any questions, feedback, or need assistance, please realize this is a solo project and I'll do my best to get back to you!
            </p>
          </div>

          <div className="inline-flex items-center justify-center p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-100 transition-colors">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-2">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Contact via Email</p>
                <a
                  href="mailto:next-idea@outlook.com"
                  className="text-2xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                >
                  next-idea@outlook.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
