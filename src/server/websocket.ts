import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

/**
 * Set up WebSocket server for real-time updates.
 */
export function setupWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log('📡 WebSocket client connected');

    ws.on('close', () => {
      console.log('📡 WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  return wss;
}

/**
 * Broadcast a message to all connected WebSocket clients.
 */
export function broadcast(wss: WebSocketServer, data: any): void {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
