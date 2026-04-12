import { Tag } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";

/**
 * Pricing views: Tag icon + PageSectionCard.
 */
export default function PricingPageShell({ title, subtitle, actions, children, footer, maxWidthClass = "max-w-7xl" }) {
  return (
    <PageSectionCard
      title={title}
      subtitle={subtitle}
      actions={actions}
      footer={footer}
      maxWidthClass={maxWidthClass}
      icon={<Tag className="w-6 h-6 text-iregistrygreen shrink-0" />}
    >
      {children}
    </PageSectionCard>
  );
}
