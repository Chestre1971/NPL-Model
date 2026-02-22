import type { ReactNode } from 'react';

/** Numbered question card  consistent across all module question sections. */
export function QuestionBlock({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-8 border-l-2 border-blue-200 pl-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
          {num}
        </span>
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      </div>
      {children}
    </div>
  );
}

