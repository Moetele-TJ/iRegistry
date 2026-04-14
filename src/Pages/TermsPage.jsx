import { Link } from "react-router-dom";
import PrintPdfButton from "../components/PrintPdfButton.jsx";
import { usePrintDocument } from "../hooks/usePrintDocument.js";

function TermSection({ id, n, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg sm:text-xl font-bold text-iregistrygreen flex flex-wrap gap-x-2 gap-y-1 items-baseline border-b-2 border-emerald-200/80 pb-2 mb-4">
        <span className="tabular-nums text-emerald-800 shrink-0">{n}.</span>
        <span>{title}</span>
      </h2>
      <div className="text-[15px] leading-relaxed text-gray-700 space-y-3">{children}</div>
    </section>
  );
}

const toc = [
  { id: "t1", label: "Agreement" },
  { id: "t2", label: "The service" },
  { id: "t3", label: "Eligibility & accounts" },
  { id: "t4", label: "Your content & listings" },
  { id: "t5", label: "Acceptable use" },
  { id: "t6", label: "Credits & fees" },
  { id: "t7", label: "Verification & third parties" },
  { id: "t8", label: "Disclaimer of warranties" },
  { id: "t9", label: "Limitation of liability" },
  { id: "t10", label: "Indemnity" },
  { id: "t11", label: "Suspension & termination" },
  { id: "t12", label: "Changes & notices" },
  { id: "t13", label: "General" },
];

export default function TermsPage() {
  const { contentRef, printAsPdf } = usePrintDocument();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white print:min-h-0">
      <div
        ref={contentRef}
        className="print-document max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12 print:py-4 print:max-w-none"
      >
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">
                Terms &amp; conditions
              </h1>
              <PrintPdfButton onPrint={printAsPdf} />
            </div>
            <p className="text-sm text-gray-600 mt-3 max-w-3xl leading-relaxed">
              These terms govern your access to and use of iRegistry. By creating an account or using the service, you
              agree to them. For how to use the product, see the{" "}
              <Link to="/guide" className="font-semibold text-iregistrygreen hover:underline">
                User guide
              </Link>{" "}
              and{" "}
              <Link to="/faq" className="font-semibold text-iregistrygreen hover:underline">
                FAQ
              </Link>
              . This page is provided for information; your deploying organisation may add or override terms in a
              separate agreement.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Last updated: April 2026. Version 1.0.
            </p>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-gradient-to-b from-white to-gray-50/40 space-y-10">
            <nav
              aria-label="Table of contents"
              className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5 shadow-sm"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900/90 mb-3">
                Contents
              </h2>
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {toc.map((item, i) => (
                  <li key={item.id} className="flex gap-2 items-baseline min-w-0">
                    <span className="font-bold text-emerald-700 shrink-0 w-6">{i + 1}.</span>
                    <a
                      href={`#${item.id}`}
                      className="text-iregistrygreen hover:underline font-medium truncate"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="space-y-10 max-w-4xl">
              <TermSection id="t1" n="1" title="Agreement to these terms">
                <p>
                  These Terms &amp; Conditions (&quot;Terms&quot;) form a binding agreement between you and the operator
                  of the iRegistry service you are using (the &quot;Service&quot;). If you do not agree, do not use the
                  Service. Continued use after changes are posted constitutes acceptance of the updated Terms where
                  permitted by law.
                </p>
              </TermSection>

              <TermSection id="t2" n="2" title="The service">
                <p>
                  iRegistry provides tools to register and manage records of valuable items, support verification
                  workflows, and—depending on configuration—facilitate notifications, reporting, and cooperation with
                  recovery or law enforcement. Features, availability, and pricing may vary by deployment. The Service
                  is provided on an &quot;as available&quot; basis.
                </p>
                <p>
                  Nothing in the Service constitutes legal, insurance, or law-enforcement advice. The Service does not
                  replace official registers, court orders, or statutory processes unless expressly stated by your
                  organisation.
                </p>
              </TermSection>

              <TermSection id="t3" n="3" title="Eligibility and accounts">
                <p>
                  You must provide accurate information when registering and keep your contact details current. You are
                  responsible for activity under your account, including use of one-time codes (OTP) and session limits
                  described in the product. You must not share credentials in a way that allows others to impersonate you.
                </p>
                <p>
                  You may be required to verify your identity using methods offered by the Service (for example email or
                  SMS). If you suspect unauthorised access, you should change contact channels with your administrator and
                  use sign-out and session tools where available.
                </p>
              </TermSection>

              <TermSection id="t4" n="4" title="Your content and listings">
                <p>
                  You retain ownership of information you submit (such as descriptions, photos, and serial numbers),
                  subject to the rights you grant the operator to host, process, and display it to provide the Service and
                  as required by law or deployment policy.
                </p>
                <p>
                  You represent that you have the right to submit the content you upload and that it does not infringe
                  third-party rights. You must not register items you do not own or control without proper authority.
                </p>
              </TermSection>

              <TermSection id="t5" n="5" title="Acceptable use">
                <p>You agree not to:</p>
                <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                  <li>use the Service for unlawful, harassing, or fraudulent purposes;</li>
                  <li>attempt to gain unauthorised access to systems, accounts, or data;</li>
                  <li>interfere with or overload the Service, or circumvent security or usage limits;</li>
                  <li>scrape or aggregate data from the Service in breach of these Terms or applicable policy;</li>
                  <li>misrepresent an item&apos;s status (for example theft or ownership) or misuse notifications.</li>
                </ul>
              </TermSection>

              <TermSection id="t6" n="6" title="Credits, fees, and billing">
                <p>
                  Some actions may consume <strong>credits</strong> or incur charges according to the task catalogue and
                  rules configured for your deployment. Balances, prices, and payment methods are shown in the app where
                  applicable. Fees may change with notice as described in your organisation&apos;s policies.
                </p>
                <p>
                  Unless mandatory law says otherwise, credits and prepayments may be non-refundable except at the
                  discretion of the operator or as stated in a separate commercial agreement.
                </p>
              </TermSection>

              <TermSection id="t7" n="7" title="Verification and third parties">
                <p>
                  Registry checks, serial lookups, and notifications depend on data you and others provide. Results are
                  not guaranteed to be complete or error-free. Buyers, sellers, and users should exercise their own
                  judgment. Third parties (including buyers, sellers, police, or insurers) may rely on information at
                  their own risk unless a separate contract applies.
                </p>
              </TermSection>

              <TermSection id="t8" n="8" title="Disclaimer of warranties">
                <p>
                  To the fullest extent permitted by applicable law, the Service is provided &quot;as is&quot; and
                  &quot;as available&quot; without warranties of any kind, whether express or implied, including
                  merchantability, fitness for a particular purpose, and non-infringement. The operator does not warrant
                  that the Service will be uninterrupted, error-free, or free of harmful components.
                </p>
              </TermSection>

              <TermSection id="t9" n="9" title="Limitation of liability">
                <p>
                  To the fullest extent permitted by applicable law, the operator and its affiliates, directors,
                  employees, and partners shall not be liable for any indirect, incidental, special, consequential, or
                  punitive damages, or for loss of profits, data, goodwill, or business opportunities, arising from
                  your use of the Service or inability to use it.
                </p>
                <p>
                  Where liability cannot be excluded, the total aggregate liability arising from these Terms or the
                  Service shall be limited to the greater of (a) the amounts you paid to the operator for the Service in
                  the twelve (12) months before the claim, or (b) a nominal amount where no fees were paid, unless
                  mandatory law requires otherwise.
                </p>
              </TermSection>

              <TermSection id="t10" n="10" title="Indemnity">
                <p>
                  You agree to indemnify and hold harmless the operator and its affiliates against claims, damages,
                  losses, and expenses (including reasonable legal fees) arising from your content, your breach of these
                  Terms, or your misuse of the Service, except to the extent caused by the operator&apos;s wilful
                  misconduct where such exclusion is permitted by law.
                </p>
              </TermSection>

              <TermSection id="t11" n="11" title="Suspension and termination">
                <p>
                  The operator may suspend or terminate access to the Service if you breach these Terms, if required by
                  law, or to protect users and systems. You may stop using the Service at any time. Provisions that by
                  their nature should survive (including disclaimers, limitations, and indemnities) will survive
                  termination.
                </p>
              </TermSection>

              <TermSection id="t12" n="12" title="Changes to the Service and these Terms">
                <p>
                  The Service may change or discontinue features. These Terms may be updated; material changes may be
                  communicated through the app, email, or your organisation. Continued use after the effective date may
                  constitute acceptance where permitted by law.
                </p>
              </TermSection>

              <TermSection id="t13" n="13" title="General">
                <p>
                  <strong>Governing law.</strong> These Terms are governed by the laws applicable in Botswana, without
                  regard to conflict-of-law rules, unless your organisation specifies otherwise in writing.
                </p>
                <p>
                  <strong>Severability.</strong> If any provision is held invalid, the remainder remains in effect.
                </p>
                <p>
                  <strong>Entire agreement.</strong> These Terms are the entire agreement regarding the Service to the
                  extent they apply; they do not override a separate signed agreement between you and the operator where
                  that agreement explicitly takes precedence.
                </p>
                <p>
                  <strong>Contact.</strong> For questions about these Terms, contact the support channel provided by the
                  organisation that deployed iRegistry for you.
                </p>
              </TermSection>
            </div>

            <p className="text-center text-xs text-gray-500 pt-6 border-t border-gray-100 max-w-4xl">
              This text is a template for product documentation. Have it reviewed by qualified counsel before relying on
              it as binding legal text.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
