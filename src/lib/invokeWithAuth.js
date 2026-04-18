// src/lib/invokeWithAuth.js
import { invokeFn } from "./invokeFn";
import { resolveBundledInvoke } from "./edgeBundles.js";

export async function invokeWithAuth(name, options = {}) {
  const { name: fnName, options: opts } = resolveBundledInvoke(name, options);
  return await invokeFn(fnName, opts, { withAuth: true });
}