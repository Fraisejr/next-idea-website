import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';

export default function Hero() {
    return (
        <section className="pt-32 pb-16 md:pt-48 md:pb-32 px-4 overflow-hidden">
            <div className="max-w-4xl mx-auto text-center space-y-8">

                {/* App Icon */}
                <div className="relative w-28 h-28 mx-auto shadow-2xl rounded-[2.5rem] overflow-hidden transform hover:scale-105 transition-transform duration-500 bg-gradient-to-br from-blue-500 to-red-500 p-1">
                    <Image
                        src="/logo.png"
                        alt="Next Idea App Icon"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900">
                        Next Idea
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        Organize your life, clear your mind, and boost your productivity.
                    </p>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Link
                        href="https://apps.apple.com/es/app/next-idea/id6448846931?l=en-GB"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-all hover:shadow-lg hover:shadow-blue-500/25 min-w-[200px]"
                    >
                        Download on App Store
                    </Link>
                    <Link
                        href="#features"
                        className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-all min-w-[200px]"
                    >
                        Learn More
                    </Link>
                </div>

                {/* App Store Badge (Visual Indicator) */}
                <div className="pt-8 opacity-80 hover:opacity-100 transition-opacity">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Available for iPhone, iPad & Mac</span>
                </div>
            </div>
        </section>
    );
}
