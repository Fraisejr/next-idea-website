import { Star } from 'lucide-react';

const testimonials = [
    {
        text: "I was looking for a SIMPLE app to organize my life and here we go. Very intuitive interface, easy to follow talk flow, ADHD friendly. I recommend!",
        author: "Bycircle3000",
        date: "07/12/2025"
    },
    {
        text: "Finally I have my to do list in order. Super useful app.",
        author: "Moonshine262",
        date: "05/09/2024"
    },
    {
        text: "The best way to get a clear mind, and help you generate new creative and productive ideas.",
        author: "App User",
        date: "2026"
    }
];

export default function Testimonials() {
    return (
        <section className="py-24 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                        What Users Say
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((review, index) => (
                        <div key={index} className="flex flex-col h-full p-8 bg-gray-50 rounded-2xl">
                            <div className="flex gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <blockquote className="flex-grow text-gray-700 font-medium mb-6 leading-relaxed">
                                "{review.text}"
                            </blockquote>
                            <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-200 pt-4 mt-auto">
                                <span className="font-semibold text-gray-900">{review.author}</span>
                                <span>{review.date}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
