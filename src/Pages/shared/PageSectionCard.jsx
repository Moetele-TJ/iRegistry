/**
 * Dashboard page shell: white rounded container, emerald gradient header — matches Profile & Items.
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
    <div className={`${maxWidthClass} mx-auto w-full`}>
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight flex items-center gap-2 flex-wrap">
                {icon ? <span className="shrink-0 flex items-center">{icon}</span> : null}
                <span>{title}</span>
              </h1>
              {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
          </div>
        </div>
        <div className="bg-gradient-to-b from-white to-gray-50/40">{children}</div>
      </div>
      {footer ? <div className="mt-4 px-1 text-sm text-gray-500">{footer}</div> : null}
    </div>
  );
}
