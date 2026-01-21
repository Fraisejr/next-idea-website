import { Target, ListTodo, Tag, Cloud } from 'lucide-react';

const features = [
    {
        title: "Focus List",
        description: "Prioritize your day by adding only the tasks you intend to complete now. Avoid overwhelm.",
        icon: Target,
        color: "bg-blue-100 text-blue-600",
    },
    {
        title: "Projects",
        description: "Organize multi-step outcomes into projects. Keep your actionable tasks separate from big goals.",
        icon: ListTodo,
        color: "bg-purple-100 text-purple-600",
    },
    {
        title: "Context Tags",
        description: "Batch tasks by context (e.g., @home, @office) to clear your list efficiently.",
        icon: Tag,
        color: "bg-red-100 text-red-600",
    },
    {
        title: "iCloud Sync",
        description: "Securely sync your tasks across all your Apple devices. Your data stays private.",
        icon: Cloud,
        color: "bg-cyan-100 text-cyan-600",
    },
];

export default function Features() {
    return (
        <section id="features" className="py-24 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                        Designed for Focus
                    </h2>
                    <p className="mt-4 text-lg text-gray-600">
                        Everything you need to get things done, without the clutter.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="group relative bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300"
                        >
                            <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-6`}>
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">
                                {feature.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
