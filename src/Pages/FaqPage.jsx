import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

function FaqItem({ id, question, children }) {
  return (
    <details
      id={id}
      className="scroll-mt-24 rounded-2xl border border-emerald-100 bg-white shadow-sm open:border-emerald-200/80 open:shadow-md transition-shadow open:[&_.faq-chevron]:rotate-180"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-iregistrygreen hover:bg-emerald-50/40 rounded-2xl [&::-webkit-details-marker]:hidden">
        <span className="pr-2">{question}</span>
        <ChevronDown
          className="faq-chevron h-5 w-5 shrink-0 text-emerald-600 transition-transform duration-200"
          aria-hidden
        />
      </summary>
      <div className="border-t border-emerald-50 px-5 pb-5 pt-4 text-[15px] leading-relaxed text-gray-700 space-y-3">
        {children}
      </div>
    </details>
  );
}

const toc = [
  { id: "q-general", label: "General" },
  { id: "q-account", label: "Account & sign-in" },
  { id: "q-items", label: "Items & status" },
  { id: "q-verify", label: "Verification" },
  { id: "q-credits", label: "Credits & billing" },
  { id: "q-privacy", label: "Privacy & help" },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">
              Frequently asked questions
            </h1>
            <p className="text-sm text-gray-600 mt-3 max-w-3xl leading-relaxed">
              Quick answers about using iRegistry as an ordinary user. For step-by-step walkthroughs of every screen,
              see the{" "}
              <Link to="/guide" className="font-semibold text-iregistrygreen hover:underline">
                User guide
              </Link>
              . You do not need to be logged in to read this page.
            </p>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-gradient-to-b from-white to-gray-50/40 space-y-10">
            <nav
              aria-label="On this page"
              className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5 shadow-sm"
            >
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900/90 mb-3">
                Jump to a section
              </h2>
              <ul className="flex flex-wrap gap-2">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-iregistrygreen hover:bg-emerald-50"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-10">
              <section id="q-general" className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                  General
                </h2>
                <div className="space-y-3">
                  <FaqItem id="q-what-is" question="What is iRegistry?">
                    <p>
                      iRegistry is a digital asset registry: a place to record valuable items (with photos, descriptions,
                      and serial numbers where applicable), show who registered them, and support checks before purchase
                      and cooperation with recovery and law enforcement when something is lost or stolen — according to
                      how your organisation has configured the system.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-who-for" question="Who is this FAQ for?">
                    <p>
                      These answers focus on everyday use with a <strong>standard user</strong> account. Administrators,
                      police, and cashiers may have extra screens and rules; those roles are not covered in detail here.
                    </p>
                  </FaqItem>
                </div>
              </section>

              <section id="q-account" className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                  Account & sign-in
                </h2>
                <div className="space-y-3">
                  <FaqItem id="q-sign-in" question="How do I sign in?">
                    <p>
                      Open <Link to="/login" className="text-iregistrygreen font-medium hover:underline">Login</Link>,
                      enter your <strong>last name</strong> and <strong>ID number</strong> exactly as registered, then
                      complete sign-in with the <strong>one-time code (OTP)</strong> sent by email or SMS, depending on
                      what your account supports and device trust rules.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-email-sms" question="Why was I asked to verify by email before SMS?">
                    <p>
                      On a new browser or device, the system may require <strong>email OTP first</strong> before SMS is
                      offered. That helps protect your account. Your organisation may also limit how many active
                      sessions you can have at once.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-signup" question="How do I create an account?">
                    <p>
                      Use{" "}
                      <Link to="/signup" className="text-iregistrygreen font-medium hover:underline">
                        Sign up
                      </Link>{" "}
                      and complete the steps with your contact details and location. You can refine your profile later
                      under <strong>Profile</strong> in the dashboard.
                    </p>
                  </FaqItem>
                </div>
              </section>

              <section id="q-items" className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                  Items & status
                </h2>
                <div className="space-y-3">
                  <FaqItem id="q-active-deleted" question="What is the difference between active, deleted, and legacy items?">
                    <p>
                      <strong>Active</strong> items are your current registrations. <strong>Deleted</strong> items are
                      removed from the active list but may be restored in many cases. <strong>Legacy</strong> items are
                      kept aside for reference (for example obsolete stock) and may be moved back to active when policy
                      allows.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-stolen" question="How do I report an item as stolen?">
                    <p>
                      From your item list or item details, use the option to <strong>report stolen</strong> where the app
                      provides it. Your dashboard highlights stolen items so you can act on alerts and notifications.
                      Exact wording and any link to police workflows depend on your deployment.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-notifications" question="What are notifications?">
                    <p>
                      <strong>Notifications</strong> tell you about events related to your items — for example when
                      someone tries to contact you about a registered item. Mark them read when you have handled them so
                      your summary stays accurate.
                    </p>
                  </FaqItem>
                </div>
              </section>

              <section id="q-verify" className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                  Verification
                </h2>
                <div className="space-y-3">
                  <FaqItem id="q-check-without-login" question="Do I need an account to check a serial number?">
                    <p>
                      You can use the verification tools on the <Link to="/" className="text-iregistrygreen font-medium hover:underline">home page</Link>{" "}
                      to look up a serial or use photo search in many cases <strong>without signing in</strong>. Free
                      limits may apply; when you are logged in, some extra checks may use <strong>credits</strong> after
                      allowances — see <Link to="/guide" className="text-iregistrygreen font-medium hover:underline">User guide</Link>{" "}
                      and <Link to="/userdashboard/pricing" className="text-iregistrygreen font-medium hover:underline">Pricing</Link>{" "}
                      (Pricing requires login).
                    </p>
                  </FaqItem>
                </div>
              </section>

              <section id="q-credits" className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                  Credits & billing
                </h2>
                <div className="space-y-3">
                  <FaqItem id="q-what-credits" question="What are credits?">
                    <p>
                      Many actions use <strong>credits</strong> — a balance on your account. Your deployment defines which
                      tasks cost credits and how much. Use <strong>Pricing</strong> to see costs, <strong>Top up</strong>{" "}
                      to add credits where self-serve top-up is enabled, and <strong>Transactions</strong> to review
                      charges and top-ups.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-insufficient" question='What does "insufficient credits" mean?'>
                    <p>
                      The action you tried requires more credits than your current balance. Open{" "}
                      <strong>Pricing</strong> to see what costs apply, then <strong>Top up</strong> or ask your registry
                      how credits are added in your organisation.
                    </p>
                  </FaqItem>
                </div>
              </section>

              <section id="q-privacy" className="scroll-mt-24 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 border-b-2 border-emerald-200/80 pb-2">
                  Privacy & help
                </h2>
                <div className="space-y-3">
                  <FaqItem id="q-who-sees" question="Who can see my registered items?">
                    <p>
                      What buyers or the public see depends on your deployment and how each item is shared. In general,
                      the registry is built to balance <strong>proof of registration</strong> with{" "}
                      <strong>privacy</strong>. Ask your organisation if you need a precise policy statement.
                    </p>
                  </FaqItem>
                  <FaqItem id="q-support" question="Where do I get help if something is wrong?">
                    <p>
                      Use the <strong>support channel</strong> your organisation provides (email, desk, or phone). For
                      how the app works, start with the{" "}
                      <Link to="/guide" className="text-iregistrygreen font-medium hover:underline">
                        User guide
                      </Link>{" "}
                      and the troubleshooting section there.
                    </p>
                  </FaqItem>
                </div>
              </section>
            </div>

            <p className="text-center text-xs text-gray-500 pt-6 border-t border-gray-100">
              FAQ for ordinary users — wording may be updated as the product evolves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
