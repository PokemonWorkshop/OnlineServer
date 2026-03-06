import { randomUUID } from 'crypto';

export interface TradeSession {
  id: string;
  playerA: string;
  playerB: string;
  selectedA: string | null;
  selectedB: string | null;
  previewA: Record<string, unknown> | null;
  previewB: Record<string, unknown> | null;
  confirmedA: boolean;
  confirmedB: boolean;
  createdAt: Date;
}

/** Maximum session lifetime in milliseconds (10 minutes) */
const SESSION_TTL_MS = 10 * 60 * 1000;
/** Cleanup interval in milliseconds (1 minute) */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/** Active trade sessions (ephemeral, no DB persistence) */
const tradeSessions: Map<string, TradeSession> = new Map();
/** Reverse index: playerId -> sessionId */
const playerToSession: Map<string, string> = new Map();

/**
 * Creates a new trade session between two players.
 * @returns the created TradeSession, or null if either player is already in a session
 */
export function createTradeSession(
  playerA: string,
  playerB: string
): TradeSession | null {
  if (playerToSession.has(playerA) || playerToSession.has(playerB)) {
    return null;
  }

  const session: TradeSession = {
    id: randomUUID(),
    playerA,
    playerB,
    selectedA: null,
    selectedB: null,
    previewA: null,
    previewB: null,
    confirmedA: false,
    confirmedB: false,
    createdAt: new Date(),
  };

  tradeSessions.set(session.id, session);
  playerToSession.set(playerA, session.id);
  playerToSession.set(playerB, session.id);

  return session;
}

/**
 * Gets the trade session a player is currently in.
 */
export function getSessionByPlayer(playerId: string): TradeSession | null {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return null;
  return tradeSessions.get(sessionId) || null;
}

/**
 * Returns the partner's playerId within the session.
 */
export function getPartner(
  session: TradeSession,
  playerId: string
): string | null {
  if (session.playerA === playerId) return session.playerB;
  if (session.playerB === playerId) return session.playerA;
  return null;
}

/**
 * Sets the selected Pokemon data and preview for a player in the session.
 * Resets both players' confirm flags when a new selection is made.
 */
export function setSelection(
  session: TradeSession,
  playerId: string,
  data: string,
  preview: Record<string, unknown>
): void {
  if (session.playerA === playerId) {
    session.selectedA = data;
    session.previewA = preview;
  } else if (session.playerB === playerId) {
    session.selectedB = data;
    session.previewB = preview;
  }
  // Reset confirms on new selection
  session.confirmedA = false;
  session.confirmedB = false;
}

/**
 * Sets the confirm flag for a player.
 * @returns true if both players have now confirmed
 */
export function setConfirm(
  session: TradeSession,
  playerId: string
): boolean {
  if (session.playerA === playerId) session.confirmedA = true;
  if (session.playerB === playerId) session.confirmedB = true;
  return session.confirmedA && session.confirmedB;
}

/**
 * Checks whether both players have selected a Pokemon.
 */
export function bothSelected(session: TradeSession): boolean {
  return session.selectedA !== null && session.selectedB !== null;
}

/**
 * Removes the trade session and cleans up reverse index.
 */
export function removeSession(session: TradeSession): void {
  tradeSessions.delete(session.id);
  playerToSession.delete(session.playerA);
  playerToSession.delete(session.playerB);
}

/**
 * Removes a session by playerId (used for disconnect cleanup).
 * @returns the removed session, or null if the player was not in a session
 */
export function removeSessionByPlayer(playerId: string): TradeSession | null {
  const session = getSessionByPlayer(playerId);
  if (!session) return null;
  removeSession(session);
  return session;
}

/**
 * Starts periodic cleanup of expired trade sessions.
 * @param onExpired - Callback invoked for each expired session with the session and both player IDs
 */
export function startSessionCleanup(
  onExpired?: (session: TradeSession) => void
): void {
  setInterval(() => {
    const now = Date.now();
    for (const session of tradeSessions.values()) {
      if (now - session.createdAt.getTime() > SESSION_TTL_MS) {
        removeSession(session);
        onExpired?.(session);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}
