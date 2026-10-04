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
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} user object { email, name, role, userId }
 */
export async function login(email, password) {
  const data = await action('auth/actions:login', {
    identifier: email,
    password,
    deviceFingerprint: getDeviceFingerprint(),
  });

  if (!data.token) {
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