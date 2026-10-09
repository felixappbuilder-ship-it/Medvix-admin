// src/scripts/admin-api.js
import { convex } from './convexClient.js';

function getToken() {
  return localStorage.getItem('adminToken');
}

// ✅ FIXED: only inject token when requireToken is true
function injectToken(args = {}, requireToken = true) {
  if (requireToken) {
    const token = getToken();
    if (!token) {
      throw new Error('No admin token found – please log in again.');
    }
    return { token, ...args };
  }
  // For public actions (login, register, etc.), do NOT add token
  return args;
}

/**
 * Unwrap a Convex action response.
 *
 * On success, returns `result.data`.
 *
 * On failure, throws an Error. If the backend attached a structured
 * `status` (e.g. DEVICE_LIMIT_REACHED, ACCOUNT_LOCKED), the error is
 * tagged with:
 *   err.code           = result.status
 *   err.backendPayload = result.data || {}
 * so callers can branch on the specific failure and read the payload.
 *
 * Plain failures with no `status` throw a bare Error(message), which
 * preserves the previous behaviour for every existing caller.
 */
function unwrapResponse(result, operationName) {
  if (!result.success) {
    const message = result.message || `${operationName} failed`;

    if (result.status) {
      const err = new Error(message);
      err.code = result.status;
      err.backendPayload = result.data || {};
      throw err;
    }

    throw new Error(message);
  }
  return result.data;
}

// All admin queries now use .action()
export async function query(path, args = {}) {
  const fullArgs = injectToken(args, true);
  console.log(`🔍 query via action('${path}')`, { args: fullArgs, tokenPresent: !!fullArgs.token });
  const result = await convex.action(path, fullArgs);
  console.log(`✅ result for '${path}':`, result);
  return unwrapResponse(result, `Query '${path}'`);
}

// All admin mutations now use .action()
export async function call(path, args = {}) {
  const fullArgs = injectToken(args, true);
  console.log(`🔧 call via action('${path}')`, { args: fullArgs, tokenPresent: !!fullArgs.token });
  const result = await convex.action(path, fullArgs);
  console.log(`✅ result for '${path}':`, result);
  return unwrapResponse(result, `Mutation '${path}'`);
}

// Auth actions (login, password reset) – token injection is disabled
export async function action(path, args = {}) {
  const fullArgs = injectToken(args, false);
  console.log(`⚡ action('${path}')`, { args: fullArgs, tokenPresent: !!fullArgs.token });
  const result = await convex.action(path, fullArgs);
  console.log(`✅ result for '${path}':`, result);
  return unwrapResponse(result, `Action '${path}'`);
}