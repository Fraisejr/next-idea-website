'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

type TaskSectionProps = {
    title: string;
    count: number;
    colorClass?: string;
    children: React.ReactNode;
    defaultCollapsed?: boolean;
};

export const TaskSection: React.FC<TaskSectionProps> = ({
    title,
    count,
    colorClass = 'text-gray-500',
    children,
    defaultCollapsed = false,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | undefined>(defaultCollapsed ? 0 : undefined);

    // Measure content whenever children change or collapse toggles
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        if (isCollapsed) {
            // Animate from current height → 0
            if (height === undefined) {
                 setHeight(el.scrollHeight);
                 requestAnimationFrame(() => {
                     requestAnimationFrame(() => setHeight(0));
                 });
            } else {
                 setHeight(0);
            }
        } else {
            // Animate from 0 → natural height
            if (height !== undefined) {
                 setHeight(el.scrollHeight);
            }
        }
    }, [isCollapsed, children]);

    // After expand animation finishes, unset the fixed height so content can grow naturally
    const handleTransitionEnd = (e: React.TransitionEvent) => {
        // Ensure we are only responding to the height transition of the container
        if (e.target === contentRef.current && e.propertyName === 'height' && !isCollapsed) {
            setHeight(undefined);
        }
    };

    return (
        <div className="mb-6">
            {/* Sticky header — sticks to top of the scroll container */}
            <div className="sticky top-0 z-10 -mx-6 px-6 bg-white/90 backdrop-blur-sm">
                <button
                    onClick={() => setIsCollapsed(prev => !prev)}
                    className={`w-full font-bold text-xs uppercase tracking-wider py-2 flex items-center gap-1.5 select-none cursor-pointer hover:opacity-70 transition-opacity ${colorClass}`}
                >
                    <ChevronRight
                        className="w-3.5 h-3.5 transition-transform duration-200 ease-in-out flex-shrink-0"
                        style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                    />
                    {title}
                    <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-[10px]">{count}</span>
                </button>
            </div>

            {/* Collapsible content */}
            <div
                ref={contentRef}
                style={{
                    height: height !== undefined ? `${height}px` : undefined,
                    overflow: height !== undefined ? 'hidden' : 'visible',
                    transition: 'height 220ms ease-in-out',
                }}
                onTransitionEnd={handleTransitionEnd}
            >
                <div className="space-y-2 pt-1">
                    {children}
                </div>
            </div>
        </div>
    );
};
