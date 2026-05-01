import { AuthenticatedWs } from './types';

/** Global map of connected clients: playerId → socket */
export const clients = new Map<string, AuthenticatedWs>();
