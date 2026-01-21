import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BookOpen, CheckCircle2, Tag, ListTodo, Brain } from 'lucide-react';

const guides = [
    {
        title: "Getting Started with Projects",
        description: "Learn how to organize your multi-step goals into manageable projects.",
        icon: ListTodo,
        steps: [
            "Click the '+' button and select 'New Project'.",
            "Give your project a clear, outcome-based title.",
            "Add individual tasks within the project.",
            "Set a due date for the entire project if needed."
        ]
    },
    {
        title: "Mastering the Focus List",
        description: "The Focus List is your daily command center. Here is how to use it effectively.",
        icon: Brain,
        steps: [
            "Review your projects and inbox at the start of the day.",
            "Mark tasks with the 'Star' icon to move them to Focus.",
            "Keep this list short (3-5 items) to avoid overwhelm.",
            "Complete these tasks before moving to others."
        ]
    },
    {
        title: "Using Tags for Context",
        description: "Batch your tasks by context to get more done in less time.",
        icon: Tag,
        steps: [
            "Create tags like @home, @office, or @phone.",
            "Assign tags to tasks when creating them.",
            "Filter your list by tag when you are in that context.",
            "Use tags to group similar types of work (e.g., 'Writing')."
        ]
    },
    {
        title: "Reviewing Your Next Actions",
        description: "Weekly reviews keep your system trusted and up to date.",
        icon: CheckCircle2,
        steps: [
            "Set aside 10 minutes every Friday.",
            "Clear your inbox.",
            "Review upcoming calendar events.",
            "Check waiting-for items."
        ]
    }
];

export default function TutorialsPage() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mb-6">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
                        How to Use Next Idea
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Master your productivity system with these simple guides.
                    </p>
                </div>

                <div className="space-y-8">
                    {guides.map((guide, index) => (
                        <div key={index} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-100 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600">
                                    <guide.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        {guide.title}
                                    </h2>
                                    <p className="text-gray-600 mb-6 leading-relaxed">
                                        {guide.description}
                                    </p>

                                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                                        <ul className="space-y-4">
                                            {guide.steps.map((step, stepIndex) => (
                                                <li key={stepIndex} className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-bold">
                                                        {stepIndex + 1}
                                                    </span>
                                                    <span className="text-gray-700">{step}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Footer />
        </main>
    );
}
