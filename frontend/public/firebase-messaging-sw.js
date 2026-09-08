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

// KHÔNG dùng onBackgroundMessage — Firebase SDK tự hiển thị notification
// từ trường `notification` trong payload (icon/badge đã set ở webpush.notification bên backend).
// Nếu thêm handler ở đây, notification sẽ hiện 2 LẦN (SDK auto + handler custom).
firebase.messaging();

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
