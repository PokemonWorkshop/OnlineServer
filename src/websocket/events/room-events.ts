export const ROOM_EVENTS = {
  CREATE: 'create_room',
  JOIN: 'join_room',
  LEAVE: 'leave_room',
  CLOSE: 'close_room',
  GET: 'get_room_by_id',
  LIST: 'get_all_rooms',
} as const;

export type RoomEvent = typeof ROOM_EVENTS[keyof typeof ROOM_EVENTS];

export const ROOM_EVENT_LIST = Object.values(ROOM_EVENTS) as readonly string[];


export const ROOM_OUTBOUND_EVENTS = {
  CREATED: 'room_created',
  UPDATED: 'room_updated',
  CLOSED: 'room_closed',
  GET: 'room_get_by_id',
  LIST: 'room_get_all',
} as const;

export type RoomOutboundEvent =
  typeof ROOM_OUTBOUND_EVENTS[keyof typeof ROOM_OUTBOUND_EVENTS];


