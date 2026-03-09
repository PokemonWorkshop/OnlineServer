/**
 * Tests for src/services/PlayerService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPlayerFindOne = vi.fn();
const mockPlayerUpdateMany = vi.fn();
const mockPlayerDeleteOne = vi.fn();
const mockGtsDeleteOne = vi.fn();
const mockPendingDeleteMany = vi.fn();

vi.mock('../../src/models/Player', () => ({
  Player: {
    findOne: (...a: any[]) => ({ lean: () => mockPlayerFindOne(...a) }),
    updateMany: (...a: any[]) => mockPlayerUpdateMany(...a),
    deleteOne: (...a: any[]) => mockPlayerDeleteOne(...a),
  },
  playerExpiresAt: () => new Date(),
}));

vi.mock('../../src/models/GtsDeposit', () => ({
  GtsDeposit: { deleteOne: (...a: any[]) => mockGtsDeleteOne(...a) },
}));

vi.mock('../../src/models/GtsPendingResult', () => ({
  GtsPendingResult: {
    deleteMany: (...a: any[]) => mockPendingDeleteMany(...a),
  },
}));

import { PlayerService } from '../../src/services/PlayerService';

const service = new PlayerService();

describe('PlayerService.deletePlayer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok: false when player is not found', async () => {
    mockPlayerFindOne.mockResolvedValue(null);
    const result = await service.deletePlayer('ghost-id');
    expect(result).toEqual({ ok: false, error: 'Player not found' });
    expect(mockPlayerDeleteOne).not.toHaveBeenCalled();
  });

  it("removes the player from other players' friends lists", async () => {
    mockPlayerFindOne.mockResolvedValue({
      playerId: 'p1',
      friendCode: 'FC001',
    });
    mockPlayerUpdateMany.mockResolvedValue({});
    mockGtsDeleteOne.mockResolvedValue({});
    mockPendingDeleteMany.mockResolvedValue({});
    mockPlayerDeleteOne.mockResolvedValue({});

    await service.deletePlayer('p1');

    expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
      { friends: 'FC001' },
      { $pull: { friends: 'FC001' } },
    );
  });

  it("removes the player from other players' pendingRequests lists", async () => {
    mockPlayerFindOne.mockResolvedValue({
      playerId: 'p1',
      friendCode: 'FC001',
    });
    mockPlayerUpdateMany.mockResolvedValue({});
    mockGtsDeleteOne.mockResolvedValue({});
    mockPendingDeleteMany.mockResolvedValue({});
    mockPlayerDeleteOne.mockResolvedValue({});

    await service.deletePlayer('p1');

    expect(mockPlayerUpdateMany).toHaveBeenCalledWith(
      { pendingRequests: 'FC001' },
      { $pull: { pendingRequests: 'FC001' } },
    );
  });

  it("deletes the player's GTS deposit", async () => {
    mockPlayerFindOne.mockResolvedValue({
      playerId: 'p1',
      friendCode: 'FC001',
    });
    mockPlayerUpdateMany.mockResolvedValue({});
    mockGtsDeleteOne.mockResolvedValue({});
    mockPendingDeleteMany.mockResolvedValue({});
    mockPlayerDeleteOne.mockResolvedValue({});

    await service.deletePlayer('p1');

    expect(mockGtsDeleteOne).toHaveBeenCalledWith({ depositorId: 'p1' });
  });

  it("deletes the player's GtsPendingResult documents", async () => {
    mockPlayerFindOne.mockResolvedValue({
      playerId: 'p1',
      friendCode: 'FC001',
    });
    mockPlayerUpdateMany.mockResolvedValue({});
    mockGtsDeleteOne.mockResolvedValue({});
    mockPendingDeleteMany.mockResolvedValue({});
    mockPlayerDeleteOne.mockResolvedValue({});

    await service.deletePlayer('p1');

    expect(mockPendingDeleteMany).toHaveBeenCalledWith({ recipientId: 'p1' });
  });

  it('deletes the player document after all cascade operations', async () => {
    mockPlayerFindOne.mockResolvedValue({
      playerId: 'p1',
      friendCode: 'FC001',
    });
    mockPlayerUpdateMany.mockResolvedValue({});
    mockGtsDeleteOne.mockResolvedValue({});
    mockPendingDeleteMany.mockResolvedValue({});
    mockPlayerDeleteOne.mockResolvedValue({});

    await service.deletePlayer('p1');

    // All cascade ops AND the final delete must have been called
    expect(mockPlayerUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockGtsDeleteOne).toHaveBeenCalledTimes(1);
    expect(mockPendingDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockPlayerDeleteOne).toHaveBeenCalledTimes(1);
  });

  it('returns ok: true on success', async () => {
    mockPlayerFindOne.mockResolvedValue({
      playerId: 'p1',
      friendCode: 'FC001',
    });
    mockPlayerUpdateMany.mockResolvedValue({});
    mockGtsDeleteOne.mockResolvedValue({});
    mockPendingDeleteMany.mockResolvedValue({});
    mockPlayerDeleteOne.mockResolvedValue({});

    const result = await service.deletePlayer('p1');
    expect(result).toEqual({ ok: true });
  });
});
