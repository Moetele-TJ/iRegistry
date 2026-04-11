-- Billable SMS OTP for login (email OTP remains free).

INSERT INTO public.task_catalog (code, name, description, credits_cost, active)
VALUES
  (
    'SMS_LOGIN_OTP',
    'SMS login code',
    'One-time login code sent by SMS (email OTP is free)',
    1,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  credits_cost = EXCLUDED.credits_cost,
  active = EXCLUDED.active,
  updated_at = now();
