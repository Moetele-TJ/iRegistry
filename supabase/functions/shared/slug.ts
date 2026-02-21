// supabase/functions/shared/slug.ts

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

export async function generateUniqueSlug({
  supabase,
  baseSlug,
  excludeId,
}: {
  supabase: any;
  baseSlug: string;
  excludeId?: string;
}) {
  let slug = baseSlug;

  let query = supabase
    .from("items")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;

  if (data && data.length > 0) {
    const used = data.map((i: any) => i.slug);

    let counter = 1;
    while (used.includes(`${baseSlug}-${counter}`)) {
      counter++;
    }

    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}