import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

/**
 * Gateway realtime. Client kết nối với token JWT ở handshake.auth.token.
 * Mỗi user join room riêng `user:<id>` để nhận thông báo cá nhân.
 * Không log connect/disconnect vì iOS + PWA hay ngắt/nối liên tục
 * (khóa màn hình, chuyển tab...) → gây spam log.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  pingInterval: 30000,   // ping mỗi 30s (thay vì 25s mặc định)
  pingTimeout: 60000,    // chờ pong tới 60s trước khi đóng (thay vì 20s)
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      const payload = this.jwt.verify(token);
      const userId = payload.sub;
      client.join(`user:${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // im lặng — client sẽ tự reconnect
  }

  // Đẩy thông báo tới 1 user
  pushToUser(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('notification', payload);
  }
}
