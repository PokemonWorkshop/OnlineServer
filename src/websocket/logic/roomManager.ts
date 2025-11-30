import { IRoom, RoomId } from "@root/src/models/room";

export class RoomManager {
  private rooms: Map<RoomId, IRoom> = new Map();

  public createRoom(playerId: string, maxPlayers: number = 4): IRoom {
    const id = crypto.randomUUID();
    const room: IRoom = {
      id,
      players: [playerId],
      maxPlayers: maxPlayers,
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    console.log(`Room ${id} created by player ${playerId} with ${maxPlayers} players`);
    return room;
  }

  public joinRoom(playerId: string, roomId: RoomId): IRoom | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= room.maxPlayers) return null;
    room.players.push(playerId);
    return room;
  }

  public leaveRoom(playerId: string): void {
    for (const [id, room] of this.rooms.entries()) {
      const index = room.players.indexOf(playerId);
      if (index !== -1) {
        room.players.splice(index, 1);
        if (room.players.length === 0) {
          this.rooms.delete(id);
          console.log(`Room ${id} deleted because it is empty`);
        }
        console.log(`Player ${playerId} left room ${id}`);
        break;
      }
    }
  }

  public closeRoom(roomId: RoomId): void {
    const room = this.rooms.get(roomId);
    if (room) {
      console.log(`Room ${roomId} closed by player ${room.players[0]}`);
      this.rooms.delete(roomId);
    }
  }

  public getRoomByPlayer(playerId: string): IRoom | undefined {
    return Array.from(this.rooms.values()).find((r) =>
      r.players.includes(playerId)
    );
  }

  public getRoom(roomId: RoomId): IRoom | undefined {
    return this.rooms.get(roomId);
  }

  public getAllRooms(): Map<RoomId, IRoom> {
    return this.rooms;
  }
}
