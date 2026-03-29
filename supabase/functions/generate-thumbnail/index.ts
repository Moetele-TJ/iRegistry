// supabase/functions/generate-thumbnail
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sharp from "npm:sharp";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

serve(async (req) => {

  const { originalPath, thumbPath } = await req.json();

  const { data, error } = await supabase
    .storage
    .from("item-photos")
    .download(originalPath);

  if (error || !data) {
    return new Response(
      JSON.stringify({ success:false, message:"Original image not found"}),
      { status:400 }
    );
  }

  const buffer = await data.arrayBuffer();

  const thumb = await sharp(buffer)
    .resize(400)
    .jpeg({ quality: 70 })
    .toBuffer();

  await supabase
    .storage
    .from("item-photos")
    .upload(thumbPath, thumb, {
      contentType: "image/jpeg",
      upsert: true
    });

  return new Response(JSON.stringify({ success: true }));
});