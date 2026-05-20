import { Link } from "react-router-dom";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import {
  hasPublicContactDetails,
  mailtoHref,
  telHref,
  whatsappHref,
} from "../lib/publicContact.js";
import { usePublicContact } from "../hooks/usePublicContact.js";
import Spinner from "../components/Spinner.jsx";

function ContactCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iregistrygreen/10 text-iregistrygreen">
          <Icon size={20} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 space-y-2">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <div className="text-[15px] leading-relaxed text-gray-700 space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ContactLink({ href, children, external }) {
  if (!href) return <span>{children}</span>;
  return (
    <a
      href={href}
      className="font-medium text-iregistrygreen hover:underline break-words"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export default function ContactPage() {
  const { contact, loading, error } = usePublicContact();
  const { operatorName, email, phone, whatsapp, address, hours, tagline } = contact;
  const configured = hasPublicContactDetails(contact);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">Contact us</h1>
            <p className="text-sm text-gray-600 mt-3 max-w-3xl leading-relaxed">
              {tagline ||
                `Reach ${operatorName} for account help, registry questions, or general enquiries. You do not need to be logged in to use this page.`}
            </p>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-gradient-to-b from-white to-gray-50/40">
            {loading ? (
              <div className="py-8">
                <Spinner label="Loading contact details…" />
              </div>
            ) : null}

            {error && !loading ? (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Could not refresh contact details from the server. Showing saved or default information.
              </div>
            ) : null}

            {!loading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                  {email ? (
                    <ContactCard icon={Mail} title="Email">
                      <p>
                        <ContactLink href={mailtoHref(email)}>{email}</ContactLink>
                      </p>
                      <p className="text-sm text-gray-500">
                        Best for account issues, billing questions, and non-urgent support.
                      </p>
                    </ContactCard>
                  ) : null}

                  {phone ? (
                    <ContactCard icon={Phone} title="Phone">
                      <p>
                        <ContactLink href={telHref(phone)}>{phone}</ContactLink>
                      </p>
                      <p className="text-sm text-gray-500">Voice calls during support hours where listed below.</p>
                    </ContactCard>
                  ) : null}

                  {whatsapp ? (
                    <ContactCard icon={MessageCircle} title="WhatsApp">
                      <p>
                        <ContactLink href={whatsappHref(whatsapp)} external>
                          {phone || whatsapp}
                        </ContactLink>
                      </p>
                      <p className="text-sm text-gray-500">Opens WhatsApp in a new tab when tapped on mobile.</p>
                    </ContactCard>
                  ) : null}

                  {address ? (
                    <ContactCard icon={MapPin} title="Office / postal address">
                      <p className="whitespace-pre-line">{address}</p>
                    </ContactCard>
                  ) : null}

                  {hours ? (
                    <ContactCard icon={Clock} title="Support hours">
                      <p className="whitespace-pre-line">{hours}</p>
                    </ContactCard>
                  ) : null}
                </div>

                {!configured ? (
                  <div className="mt-6 max-w-3xl rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-950 leading-relaxed">
                    Contact details are not available yet. An administrator can configure them under{" "}
                    <strong>Settings → Public contact page</strong>.
                  </div>
                ) : null}

                <div className="mt-10 max-w-3xl space-y-4 text-[15px] leading-relaxed text-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                    What to include when you write
                  </h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Your full name and the phone or email on your account</li>
                    <li>National ID / passport number (last few digits are enough if you prefer)</li>
                    <li>A short description of the issue and any error messages you saw</li>
                    <li>For item disputes, the item name or registry reference if you have it</li>
                  </ul>
                  <p>
                    For step-by-step help using the app, see the{" "}
                    <Link to="/guide" className="font-semibold text-iregistrygreen hover:underline">
                      User guide
                    </Link>{" "}
                    and{" "}
                    <Link to="/faq" className="font-semibold text-iregistrygreen hover:underline">
                      FAQ
                    </Link>
                    . Legal terms are in the{" "}
                    <Link to="/terms" className="font-semibold text-iregistrygreen hover:underline">
                      Terms &amp; conditions
                    </Link>
                    .
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
