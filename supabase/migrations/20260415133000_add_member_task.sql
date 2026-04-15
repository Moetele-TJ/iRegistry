-- Add task_catalog entry for organization member onboarding
INSERT INTO public.task_catalog (code, name, description, credits_cost, active)
VALUES ('ADD_MEMBER', 'Add member', 'Add a user as an organization member (staff-assisted)', 2, true)
ON CONFLICT (code) DO NOTHING;

