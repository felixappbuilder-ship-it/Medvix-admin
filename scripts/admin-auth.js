// src/scripts/admin-auth.js
import { action, query } from './admin-api.js';

function getDeviceFingerprint() {
  const key = 'adminDeviceFingerprint';
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(key, fp);
  }
  return fp;
}

/**
 * Logs in the admin with email and password.
 *
 * Success:
 *   Stores the JWT as `adminToken` in localStorage and returns the flat
 *   user object the login page expects.
 *
 * Failure:
 *   - Plain credential failure → throws Error(message), no .code.
 *   - Structured backend failure (admin-api.js preserves status/data)
 *     → throws Error(message) with:
 *         err.code               = backend status string
 *         err.backendPayload     = backend data object
 *         err.deviceLimitPayload = alias for backendPayload when the
 *                                  status is DEVICE_LIMIT_REACHED, so
 *                                  the same modal code used by the user
 *                                  app works here unchanged.
 *
 * DEVICE_LIMIT_REACHED flow:
 *   Caller shows the device-removal modal and then calls
 *   removeDeviceAndContinue(switchToken, deviceToRemoveId).
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{email:string, name:string, role:string, userId:string}>}
 */
export async function login(email, password) {
  let data;
  try {
    data = await action('auth/actions:login', {
      identifier: email,
      password,
      deviceFingerprint: getDeviceFingerprint(),
    });
  } catch (err) {
    // admin-api.js already tagged the error with .code and
    // .backendPayload. Re-expose the payload under the name the modal
    // code uses in the user app so both flows are interchangeable.
    if (err.code === 'DEVICE_LIMIT_REACHED') {
      err.deviceLimitPayload = err.backendPayload || {};
    }
    throw err;
  }

  if (!data || !data.token) {
    throw new Error('Login succeeded but no token received');
  }

  // Store token
  localStorage.setItem('adminToken', data.token);

  // Construct user object from flat response fields
  return {
    email: data.email,
    name: data.name,
    role: data.role,
    userId: data.userId,
  };
}

/**
 * Complete a login that was blocked by the device limit.
 *
 * Called after the admin picks a device to remove from the
 * DEVICE_LIMIT_REACHED modal. The switchToken proves identity —
 * no password needed. Mirrors the user-app flow in
 * scripts/auth.js::removeDeviceAndContinue.
 *
 * @param {string} switchToken
 * @param {string} deviceToRemoveId
 * @returns {Promise<{email:string, name:string, role:string, userId:string}>}
 */
export async function removeDeviceAndContinue(switchToken, deviceToRemoveId) {
  const data = await action('auth/actions:removeDeviceAndContinue', {
    switchToken,
    deviceToRemoveId,
  });

  if (!data || !data.token) {
    throw new Error('Could not complete login after removing device');
  }

  localStorage.setItem('adminToken', data.token);

  return {
    email: data.email,
    name: data.name,
    role: data.role,
    userId: data.userId,
  };
}

/**
 * List the account's active devices.
 *
 * Not part of the login flow — kept here for a future "Manage Devices"
 * admin page. Uses the same backend endpoint as the user app:
 *   auth/actions:listActiveDevices
 *
 * @returns {Promise<{devices: Array, maxDevices: number, devicesUsed: number, overLimit: boolean}>}
 */
export async function listActiveDevices() {
  return await action('auth/actions:listActiveDevices', {
    deviceFingerprint: getDeviceFingerprint(),
  });
}

/**
 * Remove a specific device from the account.
 * Cannot remove the current device (backend rejects that).
 *
 * Not part of the login flow — kept here for a future "Manage Devices"
 * admin page.
 *
 * @param {string} deviceId
 * @returns {Promise<Object>} backend response data
 */
export async function removeOtherDevice(deviceId) {
  return await action('auth/actions:removeOtherDevice', {
    deviceId,
    deviceFingerprint: getDeviceFingerprint(),
  });
}

export async function forgotPassword(email) {
  const questions = await query('auth/queries:getSecurityQuestions', { identifier: email });
  return questions;
}

export async function verifyAnswers(answers) {
  const data = await action('auth/actions:verifySecurityAnswers', { answers });
  return data;
}

export async function resetPassword(newPassword, resetToken) {
  await action('auth/actions:resetPassword', { newPassword, resetToken });
}

export function checkAuth() {
  return !!localStorage.getItem('adminToken');
}