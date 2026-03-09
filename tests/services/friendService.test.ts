/**
 * Tests for src/services/FriendService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FriendService } from '../../src/services/FriendService';

const mockFindOne            = vi.fn();
const mockFind               = vi.fn();
const mockFindByIdAndUpdate  = vi.fn();
const mockFindOneAndUpdate   = vi.fn();

vi.mock('../../src/models/Player', () => ({
  Player: {
    findOne:           (...a: any[]) => mockFindOne(...a),
    find:              (...a: any[]) => mockFind(...a),
    findByIdAndUpdate: (...a: any[]) => mockFindByIdAndUpdate(...a),
    findOneAndUpdate:  (...a: any[]) => mockFindOneAndUpdate(...a),
  },
  playerExpiresAt: () => new Date(),
}));

describe('FriendService', () => {
  let service: FriendService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FriendService();
  });

  describe('generateFriendCode', () => {
    it('returns an 8-digit numeric string', () => {
      const code = FriendService.generateFriendCode();
      expect(code).toMatch(/^\d{8}$/);
    });

    it('generates different codes across calls (probabilistic)', () => {
      const codes = new Set(Array.from({ length: 100 }, () => FriendService.generateFriendCode()));
      expect(codes.size).toBeGreaterThan(90);
    });

    it('code is between 10000000 and 99999999', () => {
      for (let i = 0; i < 20; i++) {
        const n = parseInt(FriendService.generateFriendCode(), 10);
        expect(n).toBeGreaterThanOrEqual(10_000_000);
        expect(n).toBeLessThanOrEqual(99_999_999);
      }
    });
  });

  describe('getList', () => {
    it('returns null when the player does not exist', async () => {
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      const result = await service.getList('unknown');
      expect(result).toBeNull();
    });

    it('returns friends and pendingRequests', async () => {
      const player = {
        playerId: 'p1',
        friends:         ['12345678'],
        pendingRequests: ['87654321'],
      };
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(player) });
      mockFind
        .mockReturnValueOnce({
          lean: () =>
            Promise.resolve([
              { playerId: 'p2', trainerName: 'Misty', friendCode: '12345678', lastSeen: new Date() },
            ]),
        })
        .mockReturnValueOnce({
          lean: () => Promise.resolve([{ trainerName: 'Gary', friendCode: '87654321' }]),
        });

      const result = await service.getList('p1');
      expect(result).not.toBeNull();
      expect(result!.friends).toHaveLength(1);
      expect(result!.pendingRequests).toHaveLength(1);
    });

    it('marks a recently seen friend as online', async () => {
      const player = { playerId: 'p1', friends: ['12345678'], pendingRequests: [] };
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(player) });
      mockFind
        .mockReturnValueOnce({
          lean: () =>
            Promise.resolve([
              {
                playerId:    'p2',
                trainerName: 'Misty',
                friendCode:  '12345678',
                lastSeen:    new Date(Date.now() - 30_000),
              },
            ]),
        })
        .mockReturnValueOnce({ lean: () => Promise.resolve([]) });

      const result = await service.getList('p1');
      expect(result!.friends[0].isOnline).toBe(true);
    });

    it('marks a stale friend as offline', async () => {
      const player = { playerId: 'p1', friends: ['12345678'], pendingRequests: [] };
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(player) });
      mockFind
        .mockReturnValueOnce({
          lean: () =>
            Promise.resolve([
              {
                playerId:    'p2',
                trainerName: 'Misty',
                friendCode:  '12345678',
                lastSeen:    new Date(Date.now() - 120_000),
              },
            ]),
        })
        .mockReturnValueOnce({ lean: () => Promise.resolve([]) });

      const result = await service.getList('p1');
      expect(result!.friends[0].isOnline).toBe(false);
    });
  });

  describe('heartbeat', () => {
    it('updates lastSeen for the player', async () => {
      mockFindOneAndUpdate.mockResolvedValue({});
      await service.heartbeat('player1');
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { playerId: 'player1' },
        expect.objectContaining({ lastSeen: expect.any(Date) }),
      );
    });
  });

  describe('sendRequest', () => {
    const fromPlayer = { playerId: 'p1', friendCode: '11111111', friends: [], pendingRequests: [] };
    const toPlayer   = { _id: 'to-id', playerId: 'p2', friendCode: '22222222', friends: [], pendingRequests: [] };

    it('sends a friend request successfully', async () => {
      mockFindOne
        .mockResolvedValueOnce(fromPlayer)
        .mockResolvedValueOnce(toPlayer);
      mockFindByIdAndUpdate.mockResolvedValue({});
      const result = await service.sendRequest('p1', '22222222');
      expect(result.ok).toBe(true);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'to-id',
        expect.objectContaining({ $addToSet: { pendingRequests: '11111111' } }),
      );
    });

    it('returns an error when either player is not found', async () => {
      mockFindOne.mockResolvedValue(null);
      const result = await service.sendRequest('p1', 'missing');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns an error when trying to add yourself', async () => {
      const player = { ...fromPlayer, playerId: 'p1', friendCode: '11111111' };
      mockFindOne
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce({ ...player });
      const result = await service.sendRequest('p1', '11111111');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('yourself');
    });

    it('returns an error when they are already friends', async () => {
      const from = { ...fromPlayer, friends: ['22222222'] };
      mockFindOne
        .mockResolvedValueOnce(from)
        .mockResolvedValueOnce(toPlayer);
      const result = await service.sendRequest('p1', '22222222');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('already your friend');
    });

    it('returns an error when a request is already pending', async () => {
      const to = { ...toPlayer, pendingRequests: ['11111111'] };
      mockFindOne
        .mockResolvedValueOnce(fromPlayer)
        .mockResolvedValueOnce(to);
      const result = await service.sendRequest('p1', '22222222');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('already pending');
    });
  });

  describe('acceptRequest', () => {
    const player    = { _id: 'p1-id', playerId: 'p1', friendCode: '11111111', pendingRequests: ['22222222'], friends: [] };
    const requester = { _id: 'p2-id', playerId: 'p2', friendCode: '22222222', friends: [] };

    it('accepts a request and updates both players', async () => {
      mockFindOne
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce(requester);
      mockFindByIdAndUpdate.mockResolvedValue({});
      const result = await service.acceptRequest('p1', '22222222');
      expect(result.ok).toBe(true);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('returns an error when the requesting player is not found', async () => {
      mockFindOne.mockResolvedValue(null);
      const result = await service.acceptRequest('p1', '22222222');
      expect(result.ok).toBe(false);
    });

    it('returns an error when there is no pending request from that code', async () => {
      const playerNoPending = { ...player, pendingRequests: [] };
      mockFindOne
        .mockResolvedValueOnce(playerNoPending)
        .mockResolvedValueOnce(requester);
      const result = await service.acceptRequest('p1', '22222222');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No request');
    });
  });

  describe('declineRequest', () => {
    it('removes the pending request and returns ok: true', async () => {
      mockFindOneAndUpdate.mockResolvedValue({});
      const result = await service.declineRequest('p1', '22222222');
      expect(result.ok).toBe(true);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { playerId: 'p1' },
        { $pull: { pendingRequests: '22222222' } },
      );
    });
  });

  describe('removeFriend', () => {
    const player = { _id: 'p1-id', playerId: 'p1', friendCode: '11111111' };
    const friend = { _id: 'p2-id', playerId: 'p2', friendCode: '22222222' };

    it('removes the friendship from both sides', async () => {
      mockFindOne
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce(friend);
      mockFindByIdAndUpdate.mockResolvedValue({});
      const result = await service.removeFriend('p1', '22222222');
      expect(result.ok).toBe(true);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('returns an error when one of the players is not found', async () => {
      mockFindOne.mockResolvedValue(null);
      const result = await service.removeFriend('p1', 'ghost');
      expect(result.ok).toBe(false);
    });
  });
});
