import type { ReactNode } from 'react';

/**
 * Consistent page-level wrapper for all module views.
 * - Default: max-w-6xl (charts + tables)
 * - narrow:  max-w-5xl (document-style: Module0, ICMemo, PriceDiscovery)
 * - full:    no max-width (LoanTapeView)
 */
export function PageShell({
  children,
  narrow = false,
  full = false,
}: {
  children: ReactNode;
  narrow?: boolean;
  full?: boolean;
}) {
  const maxW = full ? '' : narrow ? 'max-w-5xl' : 'max-w-6xl';
  return <div className={`p-6 ${maxW} mx-auto`}>{children}</div>;
}
