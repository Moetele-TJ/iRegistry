// supabase/functions/shared/pagination.ts

export function getPagination(
  page: number | string | undefined,
  pageSize: number | string | undefined,
  max = 50
) {
  const safePage = Math.max(1, Number(page) || 1);

  const safePageSize = Math.min(
    max,
    Math.max(1, Number(pageSize) || 20)
  );

  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  return { safePage, safePageSize, from, to };
}