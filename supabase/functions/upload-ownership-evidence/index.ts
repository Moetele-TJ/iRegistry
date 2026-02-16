//supabase/functions/upload-ownership-evidence/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BUCKET = "ownership-evidence";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* ===================== AUTH ===================== */

    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const actorUserId = session.user_id;

    if (session.role !== "admin") {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-AUTH-002",
          message: "Only administrators may perform this task.",
        },
        corsHeaders,
        403
      );
    }

    /* ===================== PARSE FORM ===================== */

    const form = await req.formData();

    const file = form.get("file");
    const itemId = form.get("itemId")?.toString();
    const type = form.get("type")?.toString();
    const referenceId = form.get("referenceId")?.toString() ?? null;

    if (!file || !(file instanceof File)) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-001",
          message: "Please upload a file.",
        },
        corsHeaders,
        400
      );
    }

    const MAX_SIZE_MB = 10;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-005",
          message: "File exceeds maximum size (10MB)",
        },
        corsHeaders,
        400
      );
    }

    const allowedMimePrefixes = ["application/pdf", "image/"];

    if (!allowedMimePrefixes.some(prefix => file.type.startsWith(prefix))) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-006",
          message: "Unsupported file type",
        },
        corsHeaders,
        400
      );
    }

    if (!itemId || !type) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-002",
          message: "Item ID and type are required",
        },
        corsHeaders,
        400
      );
    }

    if (!/^[0-9a-f-]{36}$/i.test(itemId)) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-004",
          message: "Invalid item ID format",
        },
        corsHeaders,
        400
      );
    }

    if (!file.type) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-008",
          message: "Unable to determine file type",
        },
        corsHeaders,
        400
      );
    }

    const { data: itemExists } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .is("deletedat",null)
      .maybeSingle();

    if (!itemExists) {
      return respond(
        {
          success: false,
          diag: "EVIDENCE-007",
          message: "Item not found",
        },
        corsHeaders,
        404
      );
    }

    /* ===================== BUILD STORAGE PATH ===================== */

    const uploadedAt = new Date().toISOString();
    const safeFilename = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");

    const storagePath = `${itemId}/${uploadedAt.replace(/[:.]/g, "-")}_${actorUserId}_${safeFilename}`;

    /* ===================== UPLOAD ===================== */

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Evidence upload failed:", uploadError);

      return respond(
        {
          success: false,
          diag: "EVIDENCE-003",
          message: "Failed to upload file",
        },
        corsHeaders,
        500
      );
    }

    /* ===================== RESPONSE ===================== */

    return respond(
      {
        success: true,
        evidence: {
          fileId: `${BUCKET}/${storagePath}`,
          type,
          uploadedAt,
          referenceId,
        },
      },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("upload-ownership-evidence crash:", err);

    return respond(
      {
        success: false,
        diag: "EVIDENCE-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});