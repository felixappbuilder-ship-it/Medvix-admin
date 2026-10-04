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

function unwrapResponse(result, operationName) {
  if (!result.success) {
    throw new Error(result.message || `${operationName} failed`);
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