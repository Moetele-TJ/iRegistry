#!/usr/bin/env node
/**
 * Run Supabase CLI with this repo's credentials from .env.local / .env.
 *
 * Usage:
 *   npm run sb -- db push
 *   npm run sb -- link
 *   npm run sb -- functions deploy livestock-api
 *   ./scripts/sb db push   (Git Bash / Unix)
 *
 * Required in .env.local (account that owns THIS project):
 *   SUPABASE_ACCESS_TOKEN   — Dashboard → Account → Access Tokens
 *   SUPABASE_DB_PASSWORD    — Project Settings → Database
 * Optional:
 *   SUPABASE_PROJECT_ID     — defaults from SUPABASE_URL / VITE_SUPABASE_URL
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function stripQuotes(v) {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  // Strip BOM if present (common when pasting into Windows editors)
  const text = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    // Keep full value after '=' (do not treat '#' inside passwords as comments)
    const val = stripQuotes(line.slice(eq + 1).trim());
    // File wins for project-scoped CLI so a wrong global login cannot leak in.
    process.env[key] = val;
  }
}

loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, ".env.local"));

function projectIdFromUrl(url) {
  if (!url) return "";
  const m = String(url).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : "";
}

if (!process.env.SUPABASE_PROJECT_ID) {
  process.env.SUPABASE_PROJECT_ID =
    projectIdFromUrl(process.env.SUPABASE_URL) ||
    projectIdFromUrl(process.env.VITE_SUPABASE_URL) ||
    "";
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error(`Usage: npm run sb -- <supabase-cli-args>
Examples:
  npm run sb -- db push
  npm run sb -- link
  npm run sb -- functions deploy livestock-api`);
  process.exit(1);
}

const projectId = process.env.SUPABASE_PROJECT_ID || "";
const hasToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN);
const hasDbPassword = Boolean(process.env.SUPABASE_DB_PASSWORD);

const cmd = args[0];
const needsDb =
  cmd === "db" ||
  (cmd === "migration" && ["up", "down", "repair"].includes(args[1]));
const needsLinkish =
  cmd === "link" ||
  needsDb ||
  (cmd === "functions" && ["deploy", "delete"].includes(args[1]));

if (!projectId) {
  console.error(
    "Missing SUPABASE_PROJECT_ID (or SUPABASE_URL / VITE_SUPABASE_URL) in .env.local",
  );
  process.exit(1);
}

if (needsLinkish && !hasToken && !hasDbPassword) {
  console.error(`This command needs credentials in .env.local for project ${projectId}:
  SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens
  SUPABASE_DB_PASSWORD   — Project Settings → Database
(At least the DB password is required for db push; token preferred for link/deploy.)`);
  process.exit(1);
}

if (needsDb && !hasDbPassword) {
  console.error(
    `Missing SUPABASE_DB_PASSWORD in .env.local (needed for db push against ${projectId}).`,
  );
  process.exit(1);
}

// Auto-inject --project-ref for link when omitted
let finalArgs = [...args];
if (cmd === "link" && !finalArgs.some((a) => a === "--project-ref" || a.startsWith("--project-ref="))) {
  finalArgs = ["link", "--project-ref", projectId, ...finalArgs.slice(1)];
}

const localBin = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);
const supabaseCmd = existsSync(localBin) ? localBin : "supabase";

console.error(`[sb] project=${projectId} token=${hasToken ? "yes" : "no"} db_password=${hasDbPassword ? "yes" : "no"}`);

const result = spawnSync(supabaseCmd, finalArgs, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
