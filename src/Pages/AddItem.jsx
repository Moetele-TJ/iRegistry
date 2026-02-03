import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function AddItem() {
  const navigate = useNavigate();
  const { user } = useAuth(); // must contain user.id

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // combined payload across steps
  const [form, setForm] = useState({
    category: "",
    make: "",
    model: "",
    serial1: "",
    serial2: "",
    location: "",
    photos: [],
    purchaseDate: "",
    estimatedValue: "",
    shop: "",
    warrantyExpiry: "",
    notes: "",
  });

  /* ---------------- STEP HANDLERS ---------------- */

  function nextStep(payload) {
    setForm((f) => ({ ...f, ...payload }));
    setStep(2);
  }

  function prevStep() {
    setStep(1);
  }

  /* ---------------- FINAL SUBMIT ---------------- */

  async function handleSubmit(payload) {
    setLoading(true);
    setError("");

    const finalPayload = {
      ...form,
      ...payload,
      ownerId: user?.id,
    };

    try {
      const { data, error: invokeError } =
        await supabase.functions.invoke("create-item", {
          body: finalPayload,
        });

      if (invokeError || !data?.success) {
        setError(data?.message || "Failed to save item");
        setLoading(false);
        return;
      }

      navigate("/items/" + data.item_id);
    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        {step === 1 && (
          <Step1
            initial={form}
            onNext={nextStep}
          />
        )}

        {step === 2 && (
          <Step2
            initial={form}
            onBack={prevStep}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================= */
/* ============================ STEP 1 ============================== */
/* ================================================================= */

function Step1({ initial, onNext }) {
  const [state, setState] = useState(initial);

  function submit(e) {
    e.preventDefault();
    onNext(state);
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-xl mx-auto bg-white rounded-2xl p-8 shadow-lg"
    >
      <h1 className="text-center text-2xl font-extrabold text-iregistrygreen">
        Add New Item
      </h1>
      <p className="text-center text-sm text-gray-500 mb-4">
        Step 1 of 2
      </p>

      {/* Category */}
      <Field label="Category">
        <select
          value={state.category}
          onChange={(e) => setState({ ...state, category: e.target.value })}
          className="input"
        >
          <option value="">Select category</option>
          <option value="Phone">Phone</option>
          <option value="Laptop">Laptop</option>
          <option value="TV">TV</option>
          <option value="Bicycle">Bicycle</option>
        </select>
      </Field>

      <Field label="Make">
        <input
          className="input"
          value={state.make}
          onChange={(e) =>
            setState({ ...state, make: e.target.value, model: "" })
          }
        />
      </Field>

      <Field label="Model">
        <input
          className="input"
          value={state.model}
          onChange={(e) =>
            setState({ ...state, model: e.target.value })
          }
        />
      </Field>

      <Field label="Serial Number 1">
        <input
          className="input"
          value={state.serial1}
          onChange={(e) =>
            setState({ ...state, serial1: e.target.value })
          }
        />
      </Field>

      <Field label="Serial Number 2">
        <input
          className="input"
          value={state.serial2}
          onChange={(e) =>
            setState({ ...state, serial2: e.target.value })
          }
        />
      </Field>

      <Field label="Location">
        <input
          className="input"
          value={state.location}
          onChange={(e) =>
            setState({ ...state, location: e.target.value })
          }
        />
      </Field>

      <RippleButton
        type="submit"
        className="w-full mt-4 py-3 bg-iregistrygreen text-white rounded-lg font-semibold"
      >
        Next
      </RippleButton>
    </form>
  );
}

/* ================================================================= */
/* ============================ STEP 2 ============================== */
/* ================================================================= */

function Step2({ initial, onBack, onSubmit, loading }) {
  const [state, setState] = useState(initial);

  function submit(e) {
    e.preventDefault();
    onSubmit(state);
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-xl mx-auto bg-white rounded-2xl p-8 shadow-lg"
    >
      <h1 className="text-center text-2xl font-extrabold text-iregistrygreen">
        Add New Item
      </h1>
      <p className="text-center text-sm text-gray-500 mb-4">
        Step 2 of 2
      </p>

      <Field label="Purchase Date">
        <input
          type="date"
          className="input"
          value={state.purchaseDate}
          onChange={(e) =>
            setState({ ...state, purchaseDate: e.target.value })
          }
        />
      </Field>

      <Field label="Estimated Value">
        <input
          className="input"
          value={state.estimatedValue}
          onChange={(e) =>
            setState({ ...state, estimatedValue: e.target.value })
          }
        />
      </Field>

      <Field label="Shop">
        <input
          className="input"
          value={state.shop}
          onChange={(e) =>
            setState({ ...state, shop: e.target.value })
          }
        />
      </Field>

      <Field label="Warranty Expiry">
        <input
          type="date"
          className="input"
          value={state.warrantyExpiry}
          onChange={(e) =>
            setState({ ...state, warrantyExpiry: e.target.value })
          }
        />
      </Field>

      <Field label="Notes">
        <textarea
          rows={3}
          className="input"
          value={state.notes}
          onChange={(e) =>
            setState({ ...state, notes: e.target.value })
          }
        />
      </Field>

      <div className="flex gap-4 mt-4">
        <RippleButton
          type="button"
          className="flex-1 py-3 bg-gray-100 rounded-lg"
          onClick={onBack}
        >
          Back
        </RippleButton>

        <RippleButton
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-iregistrygreen text-white rounded-lg font-semibold"
        >
          {loading ? "Saving..." : "Save"}
        </RippleButton>
      </div>
    </form>
  );
}

/* ================================================================= */

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}