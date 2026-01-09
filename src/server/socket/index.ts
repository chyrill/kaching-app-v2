/**
 * Socket.IO Server Initialization
 * 
 * Real-time communication infrastructure for:
 * - Inventory updates (Epic 6)
 * - Order notifications (Epic 4)
 * - Multi-user collaboration (Epic 3)
 * 
 * Note: This will be integrated with Next.js API route in Epic 3.
 * For now, this file contains the initialization logic and types.
 */

import { Server as SocketIOServer, type Socket } from "socket.io";
import { type Server as HTTPServer } from "http";

// Custom Socket.IO events (typed for safety)
export interface ServerToClientEvents {
  // Inventory events (Epic 6)
  "shop:inventory:updated": (data: {
    productId: string;
    shopId: string;
    stock: number;
  }) => void;
  
  // Order events (Epic 4)
  "shop:order:created": (data: {
    orderId: string;
    shopId: string;
    orderNumber: string;
  }) => void;
  
  // System notifications (Epic 6)
  "notification:push": (data: {
    type: string;
    message: string;
    timestamp: string;
  }) => void;
}

export interface ClientToServerEvents {
  // Client subscribes to shop room
  "subscribe:shop": (shopId: string) => void;
  
  // Client unsubscribes from shop room
  "unsubscribe:shop": (shopId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  shopId?: string;
  role?: string;
}

// Initialize Socket.IO server
export function initializeSocketIO(
  httpServer: HTTPServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: process.env.NODE_ENV === "production" 
          ? process.env.NEXT_PUBLIC_APP_URL ?? "https://kaching.app"
          : "http://localhost:3000",
        credentials: true,
      },
      path: "/api/socketio",
    }
  );

  // Connection handler
  io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    console.log(`✅ Socket.IO: Client connected (${socket.id})`);
    
    // Handle shop room subscriptions (multi-tenant isolation)
    socket.on("subscribe:shop", (shopId: string) => {
      void socket.join(`shop:${shopId}`);
      console.log(`   Client ${socket.id} joined shop room: ${shopId}`);
    });

    socket.on("unsubscribe:shop", (shopId: string) => {
      void socket.leave(`shop:${shopId}`);
      console.log(`   Client ${socket.id} left shop room: ${shopId}`);
    });

    socket.on("disconnect", () => {
      console.log(`   Client disconnected (${socket.id})`);
    });
  });

  console.log("✅ Socket.IO server initialized");
  console.log("   Path: /api/socketio");
  console.log("   Multi-tenant rooms: shop:${shopId}");
  console.log("   Note: Will be integrated with Next.js API route in Epic 3");

  return io;
}

// Helper function to emit event to specific shop room
export function emitToShop<K extends keyof ServerToClientEvents>(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  shopId: string,
  event: K,
  ...data: Parameters<ServerToClientEvents[K]>
) {
  io.to(`shop:${shopId}`).emit(event, ...data);
}

// Export types for use in other files
export type SocketIOServerType = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
