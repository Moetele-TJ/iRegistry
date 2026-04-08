// src/Pages/ProfilePage.jsx
import { useAuth } from "../contexts/AuthContext.jsx";
import RippleButton from "../components/RippleButton.jsx";
import { useNavigate } from "react-router-dom";
import { useAdminSidebar } from "../hooks/useAdminSidebar.jsx";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function roleLabel(role) {
  const map = {
    user: "Registered user",
    admin: "Administrator",
    police: "Police",
    cashier: "Cashier",
  };
  return map[role] || role || "—";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Keep global admin sidebar when viewing profile under /admindashboard (Admin pages register this hook).
  useAdminSidebar({ visible: !!user && user.role === "admin" });

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow border p-8 text-center text-gray-600">
          Sign in to view your profile.
          <div className="mt-4">
            <RippleButton className="px-4 py-2 rounded-lg bg-iregistrygreen text-white" onClick={() => navigate("/login")}>
              Login
            </RippleButton>
          </div>
        </div>
      </div>
    );
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  const rows = [
    { label: "Full name", value: fullName || "—" },
    { label: "Email", value: user.email || "—" },
    { label: "Role", value: roleLabel(user.role) },
    { label: "Account status", value: user.status ? String(user.status) : "—" },
    { label: "Identity verified", value: user.identity_verified ? "Yes" : "No" },
    { label: "Minor account", value: user.is_minor ? "Yes" : "No" },
    { label: "Town / Village", value: user.village || "—" },
    { label: "Ward / Street", value: user.ward || "—" },
    { label: "Police station", value: user.police_station || "—" },
    { label: "Last login", value: fmtDate(user.last_login_at) },
    { label: "User ID", value: user.id ? String(user.id) : "—" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
            onClick={() => navigate(-1)}
          >
            Back
          </RippleButton>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-iregistrygreen/10 px-6 py-4 border-b border-emerald-100">
            <p className="text-sm text-gray-600">Signed in as</p>
            <p className="text-lg font-semibold text-iregistrygreen">
              {fullName || user.email || "Account"}
            </p>
            {user.email && fullName ? (
              <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
            ) : null}
          </div>

          <dl className="divide-y divide-gray-100">
            {rows.map(({ label, value }) => (
              <div key={label} className="px-6 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 sm:mt-0.5">{label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 break-words">
                  {label === "User ID" ? (
                    <span className="font-mono text-xs text-gray-700">{value}</span>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-4 text-xs text-gray-500 text-center">
          To change your details, contact support or use admin tools if you have access.
        </p>
      </div>
    </div>
  );
}
