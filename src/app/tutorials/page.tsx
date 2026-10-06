import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Next Idea app guides" };

const guides = [
    {
        title: "Getting Started with Projects",
        description: "Learn how to organize your multi-step goals into manageable projects.",

        steps: [
            "A project is an outcome that you want to achieve that requires more than one physical action to complete.",
            "You can create a new project either using the + button at the top of the Projects tab, or by typing the new project's name when selecting a project on a task.",
            "Reorder your projects to keep the most important ones at the top of the list.",
            "Mark a project as 'On hold' by swiping left on it if you don't plan to work on it at the moment",
            "Once all the tasks in a project are completed, you can swipe to the right on the project to mark it as completed."
        ]
    },
    {
        title: "Mastering the Next actions list",
        description: "The Next actions list is your daily command center. Here is how to use it effectively.",

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

        steps: [
            "This can be tasks that you have delegated, or for which you are waiting for someone else's input.",
            "You can move a task to Waiting for by swiping left on it",
            "You can add a date to a Waiting for task so that it pops up on your radar on that day, if you want to follow up on it then."
        ]
    },
    {
        title: "Using Deferred tasks",
        description: "You can defer a task to a later date if you don't want to see it until that date.",

        steps: [
            "If you enter a due date on a task, then toggle 'Hide until date', this task will be invisible until that date, execpt in the Deferred list.",
            "This is very useful for tasks that you cannot start working on until a certain date.",
            "When that date arrives, the task will automatically appear in your action list, and in your Due and overdue list."
        ]
    },
    {
        title: "Using Tags for Context",
        description: "Batch your tasks by context to get more done in less time.",

        steps: [
            "Create tags like @home, @office, or @phone.",
            "Assign tags to tasks when creating them.",
            "Filter your list by tag when you are in that context."
        ]
    },
    {
        title: "Weekly review",
        description: "The weekly review is essential to keep your system trusted and up to date.",

        steps: [
            "The weekly review is an essential step to make you trust that your system is complete and up to date.",
            "Set aside 15 or 30 minutes once a week for your weekly review.",
            "Go to the Menu and select 'Review tasks' to get started. This will show you a checklist of the recommended actions for completing your weekly review.",
            "Tap on any of the actions to jump to the relevant view.",
            "Tap on the circle next to each of the actions to mark them as completed.",
            "Tap on Complete review once you are done, which updates the Last review date.",
        ]
    }
];

export default function TutorialsPage() {
  return <><Navbar /><main id="main-content" className="document-page"><p className="eyebrow">Inspiraeon SL / App guides</p><h1>How to use Next Idea</h1><p>Simple guides for the native Next Idea app.</p>{guides.map((guide) => <section key={guide.title}><h2>{guide.title}</h2><p>{guide.description}</p><ol className="guide-steps">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>)}<h2>Need more help?</h2><p><a href="/support">Contact app support</a>.</p></main><Footer /></>;
}
