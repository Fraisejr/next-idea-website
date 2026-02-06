import React from 'react';

type TaskSectionProps = {
    title: string;
    count: number;
    children: React.ReactNode;
};

export const TaskSection: React.FC<TaskSectionProps> = ({ title, count, children }) => {
    return (
        <div className="mb-6">
            <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2 flex items-center gap-2 select-none">
                {title}
                <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-[10px]">{count}</span>
            </h3>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
};
