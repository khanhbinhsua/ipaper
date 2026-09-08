// Service worker riêng cho Firebase Cloud Messaging.
// Chạy nền — nhận push khi app đóng/khóa màn hình.
// Dùng compat SDK vì service worker không hỗ trợ ES module import trong Firefox/Safari cũ.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA19yOJzbjbZshnEpcTFl8fvEs-NETzWA8',
  authDomain: 'ipaper-vitaliahmd.firebaseapp.com',
  projectId: 'ipaper-vitaliahmd',
  storageBucket: 'ipaper-vitaliahmd.firebasestorage.app',
  messagingSenderId: '463850684161',
  appId: '1:463850684161:web:dc837b72434a6137ca2500',
});

const messaging = firebase.messaging();

// Khi có push message ở background → tự hiển thị notification hệ thống
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'iPaper';
  const body = payload.notification?.body || '';
  const link = payload.data?.link || '/';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { link },
    tag: 'ipaper-noti',   // gộp nhiều noti cùng tag (tránh spam)
    renotify: true,
  });
});

// Click vào notification → mở app tại link tương ứng
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Nếu đã có tab iPaper mở → focus và điều hướng
      for (const c of wins) {
        if ('focus' in c) { c.focus(); (c).navigate?.(link); return; }
      }
      // Không có → mở tab mới
      if (self.clients.openWindow) return self.clients.openWindow(link);
    }),
  );
});
