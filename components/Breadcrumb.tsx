import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    view?: string;
    onClick?: () => void;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    onNavigate?: (view: string) => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
    if (items.length <= 1) return null;

    return (
        <nav className="flex items-center gap-1 text-sm mb-4 overflow-x-auto pb-1">
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                const isFirst = index === 0;
                // Use a stable key combining label and index for better React reconciliation
                const stableKey = `${item.label}-${index}`;

                return (
                    <React.Fragment key={stableKey}>
                        {index > 0 && (
                            <ChevronRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        )}
                        <button
                            onClick={() => {
                                if (!isLast) {
                                    if (item.onClick) {
                                        item.onClick();
                                    } else if (item.view && onNavigate) {
                                        onNavigate(item.view);
                                    }
                                }
                            }}
                            disabled={isLast}
                            className={`
                                flex items-center gap-1 px-2 py-1 rounded-md transition-colors whitespace-nowrap
                                ${isLast 
                                    ? 'text-slate-800 dark:text-slate-200 font-semibold cursor-default' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer'
                                }
                            `}
                        >
                            {isFirst && <Home size={14} className="shrink-0" />}
                            <span className="truncate max-w-[150px]">{item.label}</span>
                        </button>
                    </React.Fragment>
                );
            })}
        </nav>
    );
};

export default Breadcrumb;

