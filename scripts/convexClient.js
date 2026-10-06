// src/scripts/convexClient.js
import { ConvexHttpClient } from "convex/browser";

const convexUrl = "https://grateful-quail-110.convex.cloud";

export const convex = new ConvexHttpClient(convexUrl);