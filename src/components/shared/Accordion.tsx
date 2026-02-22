import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

type AccordionColor = 'default' | 'green' | 'yellow' | 'orange' | 'red';

const COLOR_BORDER: Record<AccordionColor, string> = {
  default: 'border-slate-200',
  green:   'border-green-200',
  yellow:  'border-yellow-200',
  orange:  'border-orange-200',
  red:     'border-red-200',
};

const COLOR_BADGE: Record<AccordionColor, string> = {
  default: 'bg-slate-100 text-slate-600',
  green:   'bg-green-100 text-green-700',
  yellow:  'bg-yellow-100 text-yellow-700',
  orange:  'bg-orange-100 text-orange-700',
  red:     'bg-red-100 text-red-700',
};

export function Accordion({
  title,
  badge,
  color = 'default',
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: string;
  color?: AccordionColor;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-xl mb-4 ${COLOR_BORDER[color]}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{title}</span>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_BADGE[color]}`}>
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronDown size={16} className="text-slate-400" />
          : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}
