/**
 * White card with subtle emerald header strip — same chrome as pricing forms.
 * Pass `icon` as a Lucide-sized node (e.g. <Wallet className="w-6 h-6 text-iregistrygreen shrink-0" />).
 */
export default function PageSectionCard({
  title,
  subtitle = null,
  icon = null,
  actions = null,
  children,
  footer = null,
  maxWidthClass = "max-w-7xl",
}) {
  return (
    <div className={`${maxWidthClass} mx-auto space-y-6`}>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 bg-emerald-50/90 border-b border-emerald-100/90">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {icon ? <span className="shrink-0 flex items-center">{icon}</span> : null}
              <span>{title}</span>
            </h1>
            {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
        {children}
      </div>
      {footer}
    </div>
  );
}
