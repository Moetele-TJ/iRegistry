// src/lib/invokeWithAuth.js
import { invokeFn } from "./invokeFn";

export async function invokeWithAuth(name, options = {}) {
  return await invokeFn(name, options, { withAuth: true });
}