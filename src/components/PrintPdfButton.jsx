import { Download } from "lucide-react";

/**
 * Triggers the browser print dialog (user can choose "Save as PDF"). Hidden when printing.
 */
export default function PrintPdfButton({ onPrint, label = "Download PDF", className = "" }) {
  return (
    <button
      type="button"
      onClick={onPrint}
      aria-label={`${label} — opens the print dialog so you can save as PDF`}
      className={`print:hidden inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-iregistrygreen shadow-sm transition hover:bg-emerald-50 hover:border-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${className}`}
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
