import { Link } from "react-router-dom";
import PrintPdfButton from "../../components/PrintPdfButton.jsx";
import { usePrintDocument } from "../../hooks/usePrintDocument.js";

function SectionHeading({ id, num, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4">
        <span
          className="inline-flex shrink-0 items-center justify-center min-w-[3rem] h-12 px-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-lg font-bold shadow-md ring-2 ring-emerald-100"
          aria-hidden
        >
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-iregistrygreen tracking-tight border-b-2 border-emerald-200/80 pb-2">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function SubHeading({ id, num, title, children }) {
  return (
    <div id={id} className="scroll-mt-24 mt-8 first:mt-0">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 mb-3">
        <span
          className="inline-flex shrink-0 items-center justify-center min-w-[2.75rem] h-9 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold"
          aria-hidden
        >
          {num}
        </span>
        <h3 className="text-lg font-semibold text-gray-900 pt-0.5">{title}</h3>
      </div>
      <div className="pl-0 sm:pl-[calc(2.75rem+0.75rem)] space-y-3 text-gray-700 text-[15px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Prose({ children }) {
  return <div className="space-y-3 text-gray-700 text-[15px] leading-relaxed">{children}</div>;
}

const toc = [
  { id: "s1", num: "1", label: "Verification (Buyer Protection) — check before you buy" },
  { id: "s2", num: "2", label: "Purpose of iRegistry (what it is for)" },
  { id: "s3", num: "3", label: "Signing in" },
  { id: "s4", num: "4", label: "Finding your way around" },
  { id: "s5", num: "5", label: "Dashboard home" },
  { id: "s6", num: "6", label: "Profile" },
  { id: "s7", num: "7", label: "Items — active, deleted, legacy" },
  { id: "s8", num: "8", label: "Item details and editing" },
  { id: "s9", num: "9", label: "Notifications" },
  { id: "s10", num: "10", label: "Activity" },
  { id: "s11", num: "11", label: "Credits, pricing, transactions" },
  { id: "s12", num: "12", label: "Organizations" },
  { id: "s13", num: "13", label: "Signing out and security" },
  { id: "s14", num: "14", label: "If something goes wrong" },
  { id: "s15", num: "15", label: "Glossary" },
];

export default function UserManualPage() {
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
                User guide
              </h1>
              <PrintPdfButton onPrint={printAsPdf} />
            </div>
            <div className="text-sm text-gray-600 mt-3 max-w-3xl space-y-2 leading-relaxed">
              <p>
                <strong className="text-gray-800">iRegistry</strong> is meant to be a single, trustworthy place to{" "}
                <strong className="text-gray-800">record valuable assets</strong>,{" "}
                <strong className="text-gray-800">show who they belong to</strong>, and{" "}
                <strong className="text-gray-800">support recovery and law enforcement</strong> when something is lost
                or stolen — instead of relying only on paper receipts or informal proof.
              </p>
              <p>
                The sections below explain how to use your account day to day. This guide is for people with a{" "}
                <strong className="text-gray-800">standard user</strong> account (the default role after sign-up).
                Admin, police, and cashier tools are described in separate manuals.
              </p>
              <p>
                Prefer short answers? See the{" "}
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
                {toc.map((item) => (
                  <li key={item.id} className="flex gap-2 items-baseline min-w-0">
                    <span className="font-bold text-emerald-700 shrink-0 w-6">{item.num}.</span>
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

            <div className="space-y-12">
              <SectionHeading id="s1" num="1" title="Verification (Buyer Protection) — check before you buy">
                <Prose>
                  <p className="mt-4">
                    Verification is the <strong>primary safety feature</strong> of iRegistry. It helps you check an item{" "}
                    <strong>before you buy</strong> (or before you accept it) so you do not accidentally purchase stolen
                    property.
                  </p>
                  <p>
                    Verification is <strong>free to use</strong> and available to <strong>everyone</strong>: you can verify from
                    the home page while logged out (public use), or while logged in (which may unlock extra actions after a
                    match is found).
                  </p>
                  <p>
                    Because verification is public and free, iRegistry is also <strong>self‑protecting</strong>. If checks are
                    heavily repeated or appear abusive, the app may temporarily <strong>limit</strong> checks or ask you to{" "}
                    <strong>sign in / use credits</strong> to continue — so the service stays reliable for normal users.
                  </p>
                  <p className="font-semibold text-gray-900">What you can verify</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Serial number</strong> — type the serial as printed on the device label, packaging, or in
                      the device settings.
                    </li>
                    <li>
                      <strong>Photo (where available)</strong> — use your camera to capture the serial/label area so the
                      app can try to match what it sees.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-6">How to verify (serial)</p>
                  <ol className="list-decimal pl-5 space-y-2 marker:font-semibold marker:text-emerald-700">
                    <li>Open <strong>Buyer Protection Verification</strong> on the home page.</li>
                    <li>Enter the item’s <strong>serial number</strong>.</li>
                    <li>Tap <strong>Verify</strong>.</li>
                    <li>Read the result and follow the guidance below.</li>
                  </ol>
                  <p className="font-semibold text-gray-900 mt-6">How to verify (photo)</p>
                  <ol className="list-decimal pl-5 space-y-2 marker:font-semibold marker:text-emerald-700">
                    <li>Tap the <strong>camera</strong> option in the verification panel.</li>
                    <li>Aim at the <strong>serial label</strong> or identifying plate and hold steady.</li>
                    <li>Wait for the capture and result.</li>
                  </ol>
                  <p className="font-semibold text-gray-900 mt-6">What the results mean</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Not found in registry</strong>: the serial is not currently registered. This does{" "}
                      <strong>not</strong> prove the item is safe — ask for proof of ownership.
                    </li>
                    <li>
                      <strong>Found / registered</strong>: the item is registered to someone. Ask the seller for proof
                      they are the rightful owner (or have the right to sell it).
                    </li>
                    <li>
                      <strong>Reported stolen</strong>: do <strong>not</strong> buy the item. Follow the app guidance for
                      notifying the owner or authorities where enabled.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-6">After a match (what you can do)</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Notify the registered owner</strong>: send a message so they are aware the item was seen or
                      offered for sale.
                    </li>
                    <li>
                      <strong>Request ownership transfer</strong> (logged in): the registered owner must approve before
                      the item can move to your account.
                    </li>
                    <li>
                      <strong>Inform law enforcement</strong> (where enabled): for stolen matches, some deployments allow
                      a report to support recovery workflows.
                    </li>
                  </ul>
                  <p className="mt-4">
                    Verification is a safety check and a record signal. It does not replace legal ownership documents.
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s2" num="2" title="What iRegistry is for — purpose and intent">
                <Prose>
                  <p className="mt-4">
                    The <strong>main intention</strong> of iRegistry is to reduce theft and disputed sales of valuable
                    goods by giving each registered item a <strong>clear, time-stamped record</strong> in one national
                    registry: who registered it, what it is (including identifiers such as serial numbers), and — when
                    relevant — whether it has been reported stolen. That record is designed to support{" "}
                    <strong>honest trade</strong> (buyers can check before they pay), <strong>owner alerts</strong>, and{" "}
                    <strong>cooperation with police and recovery</strong> according to how your deployment is set up.
                  </p>
                  <p>
                    In practice, the app is built so you can <strong>document your property digitally</strong> (photos,
                    descriptions, serials, categories), <strong>keep that record up to date</strong>, and{" "}
                    <strong>use it as evidence of your claim to the item</strong> in everyday situations — for example
                    when someone asks for proof, when you insure or move an asset, or when you need to report a loss.
                    It does not replace the law or official documents by itself; it <strong>complements</strong> them by
                    making consistent, shareable information available in one system.
                  </p>
                  <p className="font-semibold text-gray-900">What you are expected to use it for</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Register</strong> items you care about — electronics, tools, vehicles, or other supported
                      categories — so they are on record under your account.
                    </li>
                    <li>
                      <strong>Verify</strong> (including from the public home page) whether a serial or item appears in
                      the registry before you buy, so you are less likely to purchase stolen property.
                    </li>
                    <li>
                      <strong>Report and respond</strong> when something is stolen: update status, receive
                      notifications, and follow the paths your registry offers to contact owners or involve authorities.
                    </li>
                    <li>
                      <strong>Manage your account</strong>: profile and contact details (for OTP and alerts), credits
                      where billing applies, and a full history of transactions you can reconcile.
                    </li>
                  </ul>
                  <p>
                    Your <strong>user dashboard</strong> is the hub for everything tied to your login: registered items,
                    notifications, activity, credits, pricing, top-ups, and profile. The rest of this guide walks through
                    each area in order.
                  </p>
                  <p className="font-semibold text-gray-900 mt-6">Your digital “info bank” (keep proof in one place)</p>
                  <p>
                    Think of iRegistry as your personal <strong>information bank</strong> for valuables. After you buy something
                    important, register it here and keep the key details together — serials, photos, and supporting proof — so
                    you can retrieve it later when you need to prove ownership, sell responsibly, insure, travel, or report a
                    loss.
                  </p>
                  <p className="font-semibold text-gray-900">Catchy rule</p>
                  <p className="italic">Buy it → Register it → Keep it safe.</p>
                  <p className="font-semibold text-gray-900 mt-6">Safety of your information</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      Your item records are tied to your account and are not meant to be publicly browsed like a social profile.
                    </li>
                    <li>
                      Sensitive actions (editing, transfers, notifications) require being signed in and the right permissions.
                    </li>
                    <li>
                      If you think your account is at risk, use <strong>Profile → Sessions / trusted devices</strong> and sign out
                      old sessions.
                    </li>
                  </ul>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s3" num="3" title="Signing in">
                <Prose>
                  <ol className="mt-4 list-decimal pl-5 space-y-2 marker:font-semibold marker:text-emerald-700">
                    <li>
                      Open the <strong>Login</strong> page.
                    </li>
                    <li>
                      Enter your <strong>last name</strong> and <strong>ID number</strong> exactly as registered
                      (national ID or passport, as used on your account).
                    </li>
                    <li>
                      The app finds your account and sends a <strong>one-time code (OTP)</strong>. You may be asked to
                      choose <strong>email</strong> or <strong>SMS</strong>, depending on what is on file and device
                      trust rules.
                    </li>
                    <li>
                      Enter the code to complete sign-in.
                    </li>
                  </ol>
                  <p className="font-semibold text-gray-900 mt-6">Tips</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      If you use more than one browser or device, you may need to verify by <strong>email first</strong>{" "}
                      on a new device before SMS is offered.
                    </li>
                    <li>
                      Your account may allow <strong>up to two active sessions</strong>. If you are at the limit, sign
                      in will ask you to <strong>sign out one existing session</strong> before continuing.
                    </li>
                    <li>
                      After login, you are usually taken to your <strong>dashboard</strong> (
                      <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded text-emerald-800">/user</code>
                      ), or back to a page you tried to open before logging in.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-6">Signing up</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      New accounts are created from <strong>Sign up</strong>. You will complete steps with contact
                      details and location so your profile can be completed later in <strong>Profile</strong>.
                    </li>
                  </ul>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s4" num="4" title="Finding your way around (user dashboard)">
                <Prose>
                  <p className="mt-4">
                    When you are logged in as an ordinary user, the <strong>left sidebar</strong> (expand it by moving
                    the pointer over the green bar) includes:
                  </p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-100 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-emerald-50/90 text-left text-emerald-950">
                          <th className="px-4 py-3 font-semibold border-b border-emerald-100">Area</th>
                          <th className="px-4 py-3 font-semibold border-b border-emerald-100">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50 bg-white">
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Dashboard</td>
                          <td className="px-4 py-3">Snapshot: active/stolen counts, notifications, recent activity</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Profile</td>
                          <td className="px-4 py-3">Your personal and contact details, account identifiers</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Items</td>
                          <td className="px-4 py-3">
                            Opens a submenu: <strong>Active Items</strong>, <strong>Deleted Items</strong>,{" "}
                            <strong>Legacy items</strong>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Notifications</td>
                          <td className="px-4 py-3">Alerts about your items (e.g. contact attempts)</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Activity</td>
                          <td className="px-4 py-3">Broader activity feed for your account</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Transactions</td>
                          <td className="px-4 py-3">Credit purchases and movements (top-ups, charges where applicable)</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Organizations</td>
                          <td className="px-4 py-3">
                            Invitations, memberships, and (where enabled) organization items and wallet
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Top up</td>
                          <td className="px-4 py-3">Add credits to your account (where available)</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Pricing</td>
                          <td className="px-4 py-3">What actions cost in credits and how billing works</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4">
                    <strong>URLs (for reference)</strong> — All of these live under{" "}
                    <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded text-emerald-800">/user/…</code>{" "}
                    — for example{" "}
                    <Link to="/user/items" className="text-iregistrygreen font-medium hover:underline">
                      /user/items
                    </Link>
                    ,{" "}
                    <Link to="/user/profile" className="text-iregistrygreen font-medium hover:underline">
                      /user/profile
                    </Link>
                    .
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s5" num="5" title="Dashboard home">
                <Prose>
                  <p className="mt-4">The <strong>Dashboard</strong> page summarizes:</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600 mt-2">
                    <li>
                      <strong>Active items</strong> — items currently registered as normal (not reported stolen in a way
                      that counts here as “stolen” for the summary).
                    </li>
                    <li>
                      <strong>Stolen items</strong> — items reported as stolen (needs attention).
                    </li>
                    <li>
                      <strong>Notifications</strong> — unread vs total alerts.
                    </li>
                    <li>
                      <strong>Credits</strong> — a summary strip with balance and shortcuts to <strong>Pricing</strong>{" "}
                      and <strong>Transactions</strong> (when shown).
                    </li>
                  </ul>
                  <p className="mt-3">
                    You may also see <strong>recent activity</strong> and shortcuts such as{" "}
                    <strong>Add your first item</strong> if you have not registered anything yet.
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s6" num="6" title="Profile">
                <Prose>
                  <p className="mt-4">
                    <strong>Profile</strong> holds information used to identify you and reach you:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600 mt-2">
                    <li>
                      Name, email, phone, location fields (village, ward, police station, etc.) as configured for your
                      deployment.
                    </li>
                    <li>
                      <strong>Registry account ID</strong> — internal system identifier; useful if support asks for it.
                    </li>
                    <li>
                      <strong>Registry history</strong> — a short timeline of important account events (e.g. profile
                      updates), where enabled.
                    </li>
                  </ul>
                  <p className="mt-3">Keep your phone and email accurate so OTP and alerts work.</p>
                  <p className="font-semibold text-gray-900 mt-6">Sessions and trusted devices (security)</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Active sessions</strong>: see where your account is currently signed in, and sign out old
                      sessions if needed.
                    </li>
                    <li>
                      <strong>Trusted devices</strong>: devices you have approved for easier login (depending on your
                      deployment’s OTP rules).
                    </li>
                  </ul>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s7" num="7" title="Items — active, deleted, and legacy">
                <div className="mt-4 space-y-0">
                  <SubHeading id="s7-1" num="7.1" title="Active Items">
                    <p>
                      <strong>Active Items</strong> lists things you still treat as current registrations. From here you
                      can:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                      <li>
                        <strong>Search and filter</strong> (e.g. by category or status where available).
                      </li>
                      <li>
                        <strong>Open an item</strong> to see full details (public-style view).
                      </li>
                      <li>
                        <strong>Edit</strong> an item (where allowed), <strong>report stolen</strong>, move to{" "}
                        <strong>legacy</strong>, or <strong>delete</strong> (soft delete), depending on policy and
                        credits.
                      </li>
                      <li>
                        <strong>Export</strong> (where available): download your list for personal record-keeping.
                      </li>
                    </ul>
                    <p className="font-semibold text-gray-900 mt-4">Adding a new item</p>
                    <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                      <li>
                        Use <strong>+ Add Item</strong> (or equivalent) from the items area or dashboard.
                      </li>
                      <li>
                        Registration usually opens the <strong>Add item</strong> flow at{" "}
                        <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded text-emerald-800">/items/add</code>.
                      </li>
                      <li>
                        Some actions may <strong>cost credits</strong> after free allowances; the app should show{" "}
                        <strong>cost and balance</strong> before you confirm.
                      </li>
                    </ul>
                  </SubHeading>

                  <SubHeading id="s7-2" num="7.2" title="Deleted Items">
                    <p>
                      <strong>Deleted Items</strong> lists items you (or someone allowed) <strong>removed</strong> from
                      the active list but that can often be <strong>restored</strong>. Use this if you deleted something
                      by mistake.
                    </p>
                  </SubHeading>

                  <SubHeading id="s7-3" num="7.3" title="Legacy items">
                    <p>
                      <strong>Legacy</strong> is for items that are <strong>obsolete or kept for reference</strong> (no
                      longer in your main active list). You may <strong>restore</strong> an item back to active when
                      policy allows.
                    </p>
                  </SubHeading>
                </div>
              </SectionHeading>

              <SectionHeading id="s8" num="8" title="Item details and editing">
                <Prose>
                  <ul className="mt-4 list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>View</strong>: Open an item from the list; details are shown using the item’s link (e.g.{" "}
                      <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded text-emerald-800">
                        /items/your-item-slug
                      </code>
                      ).
                    </li>
                    <li>
                      <strong>Edit</strong>: Where you have permission, use edit to update photos, description,
                      location, or status — subject to <strong>credit rules</strong> for certain changes.
                    </li>
                  </ul>
                  <p className="mt-3">
                    If something fails because of <strong>insufficient credits</strong>, the app should tell you and
                    point you to <Link to="/user/pricing" className="text-iregistrygreen font-medium hover:underline">Pricing</Link>{" "}
                    or{" "}
                    <Link to="/user/topup" className="text-iregistrygreen font-medium hover:underline">
                      Top up
                    </Link>
                    .
                  </p>
                  <p className="font-semibold text-gray-900 mt-6">Reporting stolen and recovery steps</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      Use the item actions to <strong>report it stolen</strong> (or mark it as active again if recovered).
                    </li>
                    <li>
                      Where enabled, the item may show a simple <strong>police case</strong> area with status steps (for
                      example “Open”, “In custody”, “Cleared for return”, “Returned to owner”).
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-6">Photos and supporting documents</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      Add clear photos of the item, including the <strong>serial label</strong>.
                    </li>
                    <li>
                      Where possible, include supporting proof (for example a <strong>receipt photo</strong> or warranty label)
                      within the allowed photo slots.
                    </li>
                    <li>
                      The first photo is typically used as the <strong>main image</strong> in lists and on the item page.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-6">Deleting, restoring, and legacy</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Delete</strong>: removes an item from your active list (depending on your role/policy).
                    </li>
                    <li>
                      <strong>Deleted items</strong>: you can often <strong>restore</strong> a deleted item later.
                    </li>
                    <li>
                      <strong>Move to legacy</strong>: hides an item from active items but keeps it for reference; you can restore it.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-6">Ownership transfers (when applicable)</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      You may see <strong>pending transfer requests</strong> on your dashboard.
                    </li>
                    <li>
                      Approving a request moves the item to the requester’s account (and may use credits depending on policy).
                    </li>
                    <li>
                      Rejecting keeps the item under your account.
                    </li>
                  </ul>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s9" num="9" title="Notifications">
                <Prose>
                  <p className="mt-4">
                    <strong>Notifications</strong> lists events such as someone trying to reach you about a registered
                    item. Mark alerts as read when you have handled them so your dashboard stays clear.
                  </p>
                  <p className="mt-3 text-sm text-gray-600">
                    Tip: Some screens group alerts by item. Opening the item and marking its alerts as read will reduce
                    the unread count.
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s10" num="10" title="Activity">
                <Prose>
                  <p className="mt-4">
                    <strong>Activity</strong> shows a wider stream of what happened on your account (for example
                    item-related events), beyond a single short list on the dashboard. Exact content depends on system
                    configuration.
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s11" num="11" title="Credits, pricing, and transactions">
                <Prose>
                  <p className="mt-4">Many operations use <strong>credits</strong> (a balance on your account).</p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600 mt-3">
                    <li>
                      <Link to="/user/pricing" className="text-iregistrygreen font-medium hover:underline">
                        Pricing
                      </Link>{" "}
                      — explains <strong>costs</strong> for actions (e.g. registering extra items, certain updates).
                    </li>
                    <li>
                      <Link to="/user/topup" className="text-iregistrygreen font-medium hover:underline">
                        Top up
                      </Link>{" "}
                      — add credits when your organization supports self-serve top-up; otherwise you may be directed to a{" "}
                      <strong>cashier</strong> or other channel.
                    </li>
                    <li>
                      <Link to="/user/transactions" className="text-iregistrygreen font-medium hover:underline">
                        Transactions
                      </Link>{" "}
                      — history of top-ups and charges so you can reconcile your balance.
                    </li>
                  </ul>
                  <p className="mt-3">
                    The <strong>credits strip</strong> on the dashboard often shows <strong>balance</strong> and quick
                    links to these pages.
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s12" num="12" title="Organizations">
                <Prose>
                  <p className="mt-4">
                    If your account is linked to organizations, you can manage that under{" "}
                    <strong>Organizations</strong>:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600 mt-2">
                    <li>
                      <strong>Invitations</strong>: accept or reject an invitation to join an organization.
                    </li>
                    <li>
                      <strong>My organizations</strong>: open an organization to view its <strong>wallet</strong> (where
                      enabled) or <strong>items</strong> list.
                    </li>
                  </ul>
                  <p className="mt-3">
                    Organizations are typically used for workplaces, schools, shops, or institutions that register or
                    manage items on behalf of users.
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s13" num="13" title="Signing out and security">
                <Prose>
                  <ul className="mt-4 list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      Use <strong>Sign out</strong> / logout in the header or account menu when you finish on a shared
                      computer.
                    </li>
                    <li>
                      You can manage <strong>active sessions</strong> where the product exposes that option (e.g.
                      signing out other devices).
                    </li>
                  </ul>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s14" num="14" title="If something goes wrong">
                <Prose>
                  <ul className="mt-4 list-disc pl-5 space-y-2 marker:text-emerald-600">
                    <li>
                      <strong>Login fails</strong> — Check last name and ID, wait for a new OTP if the old one expired,
                      and try another channel (email vs SMS) if offered.
                    </li>
                    <li>
                      <strong>“Insufficient credits”</strong> — Check{" "}
                      <Link to="/user/pricing" className="text-iregistrygreen font-medium hover:underline">
                        Pricing
                      </Link>
                      , then{" "}
                      <Link to="/user/topup" className="text-iregistrygreen font-medium hover:underline">
                        Top up
                      </Link>{" "}
                      or ask your registry how to add credits.
                    </li>
                    <li>
                      <strong>Wrong list after opening the site</strong> — Refresh the page or open <strong>Items</strong>{" "}
                      again from the sidebar; lists load from the server when you open each section.
                    </li>
                  </ul>
                  <p className="mt-4">
                    For account or data issues that the app cannot solve, use the <strong>support channel</strong> your
                    organization provides (email, desk, or phone).
                  </p>
                </Prose>
              </SectionHeading>

              <SectionHeading id="s15" num="15" title="Glossary (quick)">
                <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-100 shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-emerald-50/90 text-left text-emerald-950">
                        <th className="px-4 py-3 font-semibold border-b border-emerald-100">Term</th>
                        <th className="px-4 py-3 font-semibold border-b border-emerald-100">Meaning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50 bg-white">
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Active item</td>
                        <td className="px-4 py-3">Currently in your main registered list.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Stolen</td>
                        <td className="px-4 py-3">
                          Reported as stolen; may open or link to a police case depending on setup.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Deleted (soft)</td>
                        <td className="px-4 py-3">Removed from the active list but may be restored from Deleted Items.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Legacy</td>
                        <td className="px-4 py-3">Set aside for reference; can often be restored to active.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Credits</td>
                        <td className="px-4 py-3">Balance spent on certain paid actions.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">OTP</td>
                        <td className="px-4 py-3">One-time passcode for login or verification.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionHeading>
            </div>

            <p className="text-center text-xs text-gray-500 pt-4 border-t border-gray-100">
              Document version 1.1 — ordinary user scope. Align section numbers if you add role-specific manuals later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
