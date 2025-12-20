export type RoomId = string;

export interface IRoom {
  id: RoomId;
  players: string[];
  maxPlayers: number;
  createdAt: number;
  [key: string]: unknown;
}
