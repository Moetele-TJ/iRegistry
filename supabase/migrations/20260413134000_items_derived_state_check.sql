-- Enforce derived item state invariants at the DB level.
-- Prevent items from being simultaneously deleted/legacy/stolen.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_derived_state_check'
  ) then
    alter table public.items
      add constraint items_derived_state_check
      check (
        -- deleted and legacy are mutually exclusive
        (deletedat is null or legacyat is null)
        and
        -- frozen items cannot be stolen
        (deletedat is null or reportedstolenat is null)
        and
        (legacyat is null or reportedstolenat is null)
      );
  end if;
end $$;

