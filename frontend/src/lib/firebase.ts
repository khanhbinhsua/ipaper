// Firebase Cloud Messaging cho iPaper — dùng để push notification khi app đóng/khóa màn hình
// (khi app đang mở đã có Socket.IO realtime — FCM chỉ để đánh thức khi app đóng)
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import type { Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyA19yOJzbjbZshnEpcTFl8fvEs-NETzWA8',
  authDomain: 'ipaper-vitaliahmd.firebaseapp.com',
  projectId: 'ipaper-vitaliahmd',
  storageBucket: 'ipaper-vitaliahmd.firebasestorage.app',
  messagingSenderId: '463850684161',
  appId: '1:463850684161:web:dc837b72434a6137ca2500',
};

// VAPID public key (Web Push certificates từ Firebase Console → Cloud Messaging)
export const VAPID_PUBLIC_KEY = 'BFO19Bbwe8LEoqD2tSATtNRJ4cQ_wiegJ-bRHQkP9BGazex1xjO7wOPtiWL8r94YGTkDOgHWAWQjppC0hlqNAus';

const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;
try {
  // getMessaging throw nếu môi trường không hỗ trợ (Safari iOS < 16.4, browser cũ...)
  messaging = getMessaging(app);
} catch (e) {
  console.warn('[FCM] Trình duyệt không hỗ trợ push notification:', e);
}

// Xin quyền + lấy token FCM. Trả về token (string) hoặc null.
export async function requestPushPermissionAndGetToken(): Promise<string | null> {
  if (!messaging) return null;
  if (!('Notification' in window)) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    // Service worker riêng cho FCM background
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch (e) {
    console.warn('[FCM] Không lấy được token:', e);
    return null;
  }
}

// Foreground message: khi app đang mở, FCM không tự hiện notification.
// Ta có thể dùng callback để hiện toast/badge — nhưng vì đã có Socket.IO realtime,
// mặc định bỏ qua (tránh trùng thông báo). Vẫn export để dùng khi cần.
export function onForegroundMessage(handler: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}

export { messaging };
