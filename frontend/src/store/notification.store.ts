import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import { queryClient } from '../lib/queryClient';

export interface Noti {
  id: string;
  message: string;
  documentId?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotiState {
  items: Noti[];
  unread: number;
  socket: Socket | null;
  init: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  disconnect: () => void;
}

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3100/api').replace(/\/api$/, '');

export const useNotificationStore = create<NotiState>((set, get) => ({
  items: [],
  unread: 0,
  socket: null,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Tải danh sách + số chưa đọc
    const [list, count] = await Promise.all([
      api.get('/notifications'),
      api.get('/notifications/unread-count'),
    ]);
    set({ items: list.data, unread: count.data });

    // Kết nối realtime (tránh tạo trùng)
    if (get().socket) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('notification', (noti: Noti) => {
      set((s) => ({ items: [noti, ...s.items], unread: s.unread + 1 }));
      // Cập nhật real-time: làm mới thống kê + danh sách hồ sơ + chi tiết
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document'] });
      if (noti.documentId) queryClient.invalidateQueries({ queryKey: ['document', noti.documentId] });
    });
    set({ socket });
  },

  markRead: async (id) => {
    await api.patch(`/notifications/${id}/read`);
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unread: Math.max(0, s.unread - 1),
    }));
  },

  markAllRead: async () => {
    await api.patch('/notifications/read-all');
    set((s) => ({ items: s.items.map((n) => ({ ...n, isRead: true })), unread: 0 }));
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, items: [], unread: 0 });
  },
}));
