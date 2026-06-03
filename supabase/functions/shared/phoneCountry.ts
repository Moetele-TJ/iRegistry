import countries from "../../../shared/countries.json" with { type: "json" };

type CountryRow = {
  code: string;
  name: string;
  dialCode: string;
  minLength: number;
  maxLength: number;
};

const LIST = countries as CountryRow[];

export function validatePhoneForCountry(
  countryCode: string,
  phone: string,
): { ok: true } | { ok: false; message: string } {
  const cc = String(countryCode ?? "").trim();
  if (!cc) {
    return { ok: false, message: "Country is required. Please select a country from the list." };
  }

  const meta = LIST.find((c) => c.code === cc);
  if (!meta) {
    return { ok: false, message: "Invalid country selection." };
  }

  const ph = String(phone ?? "").trim();
  if (!ph) {
    return { ok: false, message: "Phone number is required." };
  }

  const digitsOnly = ph.replace(/\D/g, "");
  const nationalNumber = digitsOnly.replace(String(meta.dialCode).replace("+", ""), "");
  if (!nationalNumber.length) {
    return { ok: false, message: "Enter the phone number after the country code." };
  }

  const length = nationalNumber.length;
  if (length < meta.minLength || length > meta.maxLength) {
    return {
      ok: false,
      message:
        `Phone number must be between ${meta.minLength} and ${meta.maxLength} digits for ${meta.name}.`,
    };
  }

  return { ok: true };
}
