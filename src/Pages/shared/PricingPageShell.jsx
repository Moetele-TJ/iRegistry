import { Tag } from "lucide-react";

/**
 * Shared chrome for all pricing views: max-width container, white card, subtle emerald header strip.
 */
export default function PricingPageShell({
  title,
  subtitle,
  actions = null,
  children,
  footer = null,
  maxWidthClass = "max-w-7xl",
}) {
  return (
    <div className={`${maxWidthClass} mx-auto space-y-6`}>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 bg-emerald-50/90 border-b border-emerald-100/90">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-iregistrygreen shrink-0" />
              {title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
      {footer}
    </div>
  );
}
