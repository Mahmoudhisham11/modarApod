importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBjfPS9z-KBPCv-QQMZhU-Puf3461a2BFU",
  authDomain: "cashatabod.firebaseapp.com",
  projectId: "cashatabod",
  storageBucket: "cashatabod.firebasestorage.app",
  messagingSenderId: "422137345819",
  appId: "1:422137345819:web:df9513752c0722172545be",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, click_action, data } = payload.data || {};

  const notificationTitle = title || "إشعار جديد";
  const notificationOptions = {
    body: body || "",
    icon: icon || "/favicon-96x96.png",
    badge: "/favicon-96x96.png",
    vibrate: [200, 100, 200],
    data: data || payload.data || {},
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const clickUrl = event.notification.data?.click_action || "/";
  event.waitUntil(clients.openWindow(clickUrl));
});
