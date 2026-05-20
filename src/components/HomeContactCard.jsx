import { Link } from "react-router-dom";
import { Clock, Mail, MapPin, MessageCircle, Phone, ArrowRight } from "lucide-react";
import { usePublicContact } from "../hooks/usePublicContact.js";
import { mailtoHref, telHref, whatsappHref } from "../lib/publicContact.js";

function ContactRow({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-iregistrygreen">
        <Icon size={18} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-sm text-gray-800 mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}

export default function HomeContactCard() {
  const { contact, loading } = usePublicContact();
  const { operatorName, email, phone, whatsapp, address, hours, tagline } = contact;

  return (
    <section
      className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100"
      aria-labelledby="home-contact-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2
            id="home-contact-heading"
            className="text-xl sm:text-2xl font-bold text-iregistrygreen tracking-tight"
          >
            Contact {operatorName}
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-xl leading-relaxed">
            {tagline ||
              "Questions about your account, registry items, or how iRegistry works? Reach our team using the details below."}
          </p>
        </div>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold shadow-sm shrink-0 self-start hover:opacity-95 transition-opacity"
        >
          Full contact page
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ContactRow icon={Mail} label="Email">
            {email ? (
              <a href={mailtoHref(email)} className="font-medium text-iregistrygreen hover:underline">
                {email}
              </a>
            ) : null}
          </ContactRow>
          <ContactRow icon={Phone} label="Phone">
            {phone ? (
              <a href={telHref(phone)} className="font-medium text-iregistrygreen hover:underline">
                {phone}
              </a>
            ) : null}
          </ContactRow>
          <ContactRow icon={MessageCircle} label="WhatsApp">
            {whatsapp ? (
              <a
                href={whatsappHref(whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-iregistrygreen hover:underline"
              >
                {phone || whatsapp}
              </a>
            ) : null}
          </ContactRow>
          <ContactRow icon={Clock} label="Hours">
            {hours ? <span className="whitespace-pre-line">{hours}</span> : null}
          </ContactRow>
          {address ? (
            <div className="sm:col-span-2">
              <ContactRow icon={MapPin} label="Address">
                <span className="whitespace-pre-line">{address}</span>
              </ContactRow>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
