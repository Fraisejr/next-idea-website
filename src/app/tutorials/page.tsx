import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BookOpen, CheckCircle2, Tag, ListTodo, Brain, ChevronRight, Clock, CalendarClock, Sun, CalendarCheck2 } from 'lucide-react';

const guides = [
    {
        title: "Getting Started with Projects",
        description: "Learn how to organize your multi-step goals into manageable projects.",
        icon: ListTodo,
        steps: [
            "You can create a new project either using the + button at the top of the Projects tab, or when by typing the new project's name from within a task.",
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
        title: "Daily task review",
        description: "The daily review is a great way to kick-start your day.",
        icon: Sun,
        steps: [
            "Before you start your day, do a quick review of your Projects and Next actions list.",
            "Move the tasks that you want to work on today to the top of the list, by swiping right on the task.",
            "You can also swipe left on several tasks and tap on Select in order to mass update your tasks."
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
                                                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                                        <ChevronRight className="w-4 h-4" />
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
