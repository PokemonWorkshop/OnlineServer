type RoomId = string;

interface Room {
  id: RoomId;
  players: string[];
  maxPlayers: number;
  createdAt: number;
  [key: string]: unknown;
}

class RoomManager {
  private rooms: Map<RoomId, Room> = new Map();

  createRoom(playerId: string): Room {
    const id = crypto.randomUUID();
    const room: Room = {
      id,
      players: [playerId],
      maxPlayers: 4,
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(playerId: string, roomId: RoomId): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= room.maxPlayers) return null;
    room.players.push(playerId);
    return room;
  }

  leaveRoom(playerId: string): void {
    for (const [id, room] of this.rooms.entries()) {
      const index = room.players.indexOf(playerId);
      if (index !== -1) {
        room.players.splice(index, 1);
        if (room.players.length === 0) this.rooms.delete(id);
        break;
      }
    }
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    return Array.from(this.rooms.values()).find((r) =>
      r.players.includes(playerId)
    );
  }

  getRoom(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId);
  }
}
