/**
 * syncChannel.js
 * BroadcastChannel wrapper for real-time sync across browser tabs (same device).
 * Also supports a VITE_API_URL for cross-device sync when a backend is deployed.
 */

const CHANNEL_NAME = 'parkme_sync';
let channel = null;

export function getSyncChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

/**
 * Broadcast a state change to all other open tabs.
 * Call this after any write operation (park, pay, issue ticket, reset).
 */
export function broadcastStateChange(eventType, payload = {}) {
  const ch = getSyncChannel();
  if (ch) {
    ch.postMessage({ eventType, payload, ts: Date.now() });
  }
}

/**
 * Subscribe to state changes from other tabs.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function onStateChange(callback) {
  const ch = getSyncChannel();
  if (!ch) return () => {};
  const handler = (event) => callback(event.data);
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}

/**
 * Whether the app should use the real backend (when VITE_API_URL is set)
 * or fall back to the localStorage mock engine.
 */
export const BACKEND_URL = import.meta.env.VITE_API_URL || null;
