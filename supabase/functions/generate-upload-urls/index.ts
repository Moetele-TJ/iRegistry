// supabase/functions/generate-upload-urls/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { isPrivilegedRole} from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return respond(
        { 
          success: false,
          diag: "GEN-URLS-001",
          message: "You do not have sufficient privileges to perform this task.",
        },
        corsHeaders,
        401
      );
    }

    const { data: authData } = await supabase.auth.getUser(
      auth.replace("Bearer ", "")
    );

    if (!authData?.user) {
      return respond(
        { 
          success: false,
          diag: "GEN-URLS-002",
          message: "You need to be logged in as a user to perform this task.",
        },
        corsHeaders,
        401
      );
    }

    // Fetch user profile
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (userError) {
      return respond(
        {
          success: false,
          diag: "GEN-URLS-USER-001",
          message: "Check your network connection or contact your Administrator.",
        },
        corsHeaders,
        500
      );
    }

    if (!userRow) {
      return respond(
        {
          success: false,
          diag: "GEN-URLS-USER-002",
          message: "User profile not found.",
        },
        corsHeaders,
        403
      );
    }

    const { itemId, files } = await req.json();

    if (!itemId || typeof itemId !== "string" || !Array.isArray(files) || files.length === 0) {
      return respond(
        { success: false,
          diag: "GEN-URLS-003",
          message: "Invalid request."
        },
        corsHeaders,
        400
      );
    }

    if (files.length > 5) {
      return respond(
        { success: false,
          diag: "GEN-URLS-007",
          message: "You can only upaload a maximum of 5 photos."
        },
        corsHeaders, 
        400
      );
    }

    // Fetch item
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id, ownerid, deletedat")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      return respond(
        { 
          success: false,
          diag: "GEN-URLS-ITEM-001", 
          message: "Check your network connection or contact your Administrator.",
        },
        corsHeaders,
        404
      );
    }
    
      if (!item || item.deletedat) {
      return respond(
        { 
          success: false,
          diag: "GEN-URLS-004", 
          message: "Item not found",
        },
        corsHeaders,
        404
      );
    }

    const isOwner = item.ownerid === userRow.id;
    const isPrivileged = isPrivilegedRole(userRow.role);

    if (!isOwner && !isPrivileged) {
      return respond(
        { 
          success: false,
          diag: "GEN-URLS-005",
          message: "You do not have suffient privileges to upload photos for this item.",
        },
        corsHeaders,
        403
      );
    }

    const uploads = [];

    for (const file of files) {
      if (
        !file ||
        typeof file.type !== "string" ||
        typeof file.size !== "number"
      ) {
        return respond(
          { 
            success: false, 
            diag: "GEN-URLS-010", 
            message: "Invalid file metadata." 
          },
          corsHeaders,
          400
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return respond(
          { 
            success: false, 
            diag: "GEN-URLS-008",
            message: "Invalid file type."
          },
          corsHeaders,
          400
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return respond(
          { 
            success: false,
            diag: "GEN-URLS-009",
            message: "File too large (max 5MB)."
          },
          corsHeaders,
          400
        );
      }

      const extension = file.type.split("/")[1];
      const filePath = `items/${itemId}/${crypto.randomUUID()}.${extension}`;

      const { data, error } = await supabase.storage
        .from("item-photos")
        .createSignedUploadUrl(filePath);

      if (error) throw error;

      uploads.push({
        path: filePath,
        signedUrl: data.signedUrl,
      });
    }

    return respond(
      { success: true,
        uploads
      }, 
      corsHeaders, 
      200
    );

  } catch (err) {
    console.error(err);
    return respond(
      { 
        success: false,
        diag: "GEN-URLS-500",
        message: "Upload initialization failed."
      },
      corsHeaders,
      500
    );
  }
});