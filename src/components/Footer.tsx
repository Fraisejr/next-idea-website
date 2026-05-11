export default function Footer() {
    return (
        <footer className="py-12 bg-white border-t border-gray-100">
            <div className="max-w-6xl mx-auto px-4 text-center">
                <p className="text-gray-500 text-sm">
                    Copyright © Next Idea 2026. Made with ❤️ for productivity.
                </p>
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                    <a href="/privacy" className="text-gray-400 hover:text-blue-600 transition-colors">Privacy Policy</a>
                    <a href="/terms" className="text-gray-400 hover:text-blue-600 transition-colors">Terms of Service</a>
                    <a href="/support" className="text-gray-400 hover:text-blue-600 transition-colors">Support</a>
                </div>
            </div>
        </footer>
    );
}
