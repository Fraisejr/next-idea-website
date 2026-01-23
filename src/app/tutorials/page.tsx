'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BookOpen, CheckCircle2, Tag, ListTodo, Brain, ChevronRight, Clock, CalendarClock, Sun, CalendarCheck2, ChevronDown, ChevronUp } from 'lucide-react';

const guides = [
    {
        title: "Getting Started with Projects",
        description: "Learn how to organize your multi-step goals into manageable projects.",
        icon: ListTodo,
        steps: [
            "A project is an outcome that you want to achieve that requires more than one physical action to complete.",
            "You can create a new project either using the + button at the top of the Projects tab, or by typing the new project's name when selecting a project on a task.",
            "If you mark a project as sequential, only the first task in that project will be visible in your task lists.",
            "Reorder your projects to keep the most important ones at the top of the list.",
            "Mark a project as 'On hold' by swiping left on it if you don't plan to work on it at the moment",
            "Once all the tasks in a project are completed, you can swipe to the right on the project to mark it as completed."
        ]
    },
    {
        title: "Mastering the Next actions list",
        description: "The Next actions list is your daily command center. Here is how to use it effectively.",
        icon: Brain,
        steps: [
            "Before you start your day, do a quick review of your Projects and Next actions list.",
            "Move the tasks that you want to work on today to the top of the list, by swiping right on the task.",
            "You can also swipe left on several tasks and tap on Select in order to mass update your tasks.",
            "If you don't plan to work on a task in the near future, you can swipe left on it and move it to the 'Someday' list.",
            "If you Next actions list gets out of control, you can also press the 'X' button at the top right of the list to clear it out, moving all tasks to the top of Someday.",
            "You can then go through your Someday list and decide what you want to move back into your Next actions list."
        ]
    },
    {
        title: "Using the Waiting for list",
        description: "The Waiting for list should contain all tasks for which you are waiting for someone else to act.",
        icon: Clock,
        steps: [
            "This can be tasks that you have delegated, or for which you are waiting for someone else's input.",
            "You can move a task to Waiting for by swiping left on it",
            "You can add a date to a Waiting for task so that it pops up on your radar on that day, if you want to follow up on it then."
        ]
    },
    {
        title: "Using Deferred tasks",
        description: "You can defer a task to a later date if you don't want to see it until that date.",
        icon: CalendarClock,
        steps: [
            "If you enter a due date on a task, then toggle 'Hide until date', this task will be invisible until that date, execpt in the Deferred list.",
            "This is very useful for tasks that you cannot start working on until a certain date.",
            "When that date arrives, the task will automatically appear in your action list, and in your Due and overdue list."
        ]
    },
    {
        title: "Using Tags for Context",
        description: "Batch your tasks by context to get more done in less time.",
        icon: Tag,
        steps: [
            "Create tags like @home, @office, or @phone.",
            "Assign tags to tasks when creating them.",
            "Filter your list by tag when you are in that context."
        ]
    },
    {
        title: "Weekly review",
        description: "The weekly review is essential to keep your system trusted and up to date.",
        icon: CalendarCheck2,
        steps: [
            "Set aside 15 or 30 minutes once a week for your weekly review.",
            "Go to the Menu and select 'Review tasks' to get started. This will show you a checklist of the recommended actions for completing your weekly review.",
            "Tap on any of the actions to jump to the relevant view.",
            "Swipe on each of the actions to complete them, and tap on Complete review once you are done, which updates the Last review date.",
            "The weekly review is a great way to make you trust that your system is complete and up to date."
        ]
    }
];

function TutorialItem({ guide, isOpen, onToggle }: { guide: typeof guides[0], isOpen: boolean, onToggle: () => void }) {
    return (
        <div
            className={`bg-gray-50 rounded-2xl border transition-all duration-200 overflow-hidden ${isOpen ? 'border-blue-200 shadow-md ring-1 ring-blue-100' : 'border-gray-200 hover:border-blue-100'
                }`}
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-4 p-6 sm:p-8 text-left focus:outline-none"
            >
                <div className={`p-3 rounded-xl shadow-sm transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                    }`}>
                    <guide.icon className="w-6 h-6" />
                </div>

                <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                        {guide.title}
                    </h2>
                </div>

                <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} text-gray-400`}>
                    <ChevronDown className="w-6 h-6" />
                </div>
            </button>

            {/* Content Area */}
            <div
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-0 pl-[5.5rem]">
                    <p className="text-gray-600 mb-6 leading-relaxed text-lg">
                        {guide.description}
                    </p>

                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <ul className="space-y-4">
                            {guide.steps.map((step, stepIndex) => (
                                <li key={stepIndex} className="flex items-start gap-3">
                                    <span className="flex-shrink-0 mt-1 text-blue-600">
                                        <ChevronRight className="w-5 h-5" />
                                    </span>
                                    <span className="text-gray-700">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TutorialsPage() {
    // Optional: Keep one open at a time (accordion style) or multiple?
    // User asked for "collapsible", screenshot shows one open. Accordion feel is usually cleaner.
    // Let's implement independent toggles for flexibility, or maybe one state.
    // I'll stick to independent for now as it's less restrictive, unless user asked for "accordion" specifically.
    // Wait, "a bit like in this screenshot" implies matching it.
    // I'll use a simple index tracker if I want strict accordion, or just independent state in the child.
    // Let's lift state to manage it here?

    // Actually, independent state is simpler for users (compare multiple guides).
    // But let's handle it in the parent to be safe if we want to add "Expand All".

    // Let's just use local state in the TutorialItem? No, strict accordion (one open) is often requested.
    // But screenshot shows *only* one open? It shows one open, others closed.
    // I'll do independent state for maximum utility.

    // Refactoring to map and use state items.

    // Instead of complex state, I will just let the TutorialItem handle itself initially?
    // No, better to lift it if I want to enforce "one open".
    // I'll use `openIndex`.

    const [openIndex, setOpenIndex] = useState<number | null>(0); // Open the first one by default? Or none? Screenshot has first one open. 

    const handleToggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

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

                <div className="space-y-4">
                    {guides.map((guide, index) => (
                        <TutorialItem
                            key={index}
                            guide={guide}
                            isOpen={openIndex === index}
                            onToggle={() => handleToggle(index)}
                        />
                    ))}
                </div>
            </div>

            <Footer />
        </main>
    );
}
