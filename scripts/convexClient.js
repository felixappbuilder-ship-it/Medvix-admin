// src/scripts/convexClient.js
import { ConvexHttpClient } from "convex/browser";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL environment variable is not set");
}

/**
 * The single Convex HTTP client instance.
 * Used exclusively by admin-api.js – no other file imports this.
 */
export const convex = new ConvexHttpClient(convexUrl);