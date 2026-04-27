/**
 * Tests for src/services/MysteryGiftService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MysteryGiftService } from '../../src/services/MysteryGiftService';

// ── Mock MysteryGift model ────────────────────────────────────────────────────

const mockFind              = vi.fn();
const mockFindOne           = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockFindOneAndUpdate  = vi.fn();
const mockExists            = vi.fn();
const mockCreate            = vi.fn();
const mockDeleteMany        = vi.fn();

vi.mock('../../src/models/MysteryGift', () => ({
  MysteryGift: {
    find:              (...a: any[]) => mockFind(...a),
    findOne:           (...a: any[]) => mockFindOne(...a),
    findByIdAndUpdate: (...a: any[]) => mockFindByIdAndUpdate(...a),
    findOneAndUpdate:  (...a: any[]) => mockFindOneAndUpdate(...a),
    exists:            (...a: any[]) => mockExists(...a),
    create:            (...a: any[]) => mockCreate(...a),
    deleteMany:        (...a: any[]) => mockDeleteMany(...a),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MysteryGiftService', () => {
  let service: MysteryGiftService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MysteryGiftService();
  });

  // ── listForPlayer ──────────────────────────────────────────────────────────

  describe('listForPlayer', () => {
    it('returns active internet gifts not yet claimed by the player', async () => {
      const gifts = [{ giftId: 'g1', title: 'Launch Gift', type: 'internet' }];
      mockFind.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve(gifts) }),
      });
      const result = await service.listForPlayer('p1');
      expect(result).toEqual(gifts);
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, type: 'internet' }),
      );
    });

    it('excludes gifts already claimed by the player', async () => {
      mockFind.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve([]) }),
      });
      await service.listForPlayer('p1');
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({ claimedBy: { $nin: ['p1'] } }),
      );
    });

    it('returns an empty array when no gifts are available', async () => {
      mockFind.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve([]) }),
      });
      const result = await service.listForPlayer('p1');
      expect(result).toEqual([]);
    });
  });

  // ── claim ──────────────────────────────────────────────────────────────────

  describe('claim', () => {
    const makeGift = (overrides = {}) => ({
      _id:       'gift-mongo-id',
      giftId:    'gift-abc',
      title:     'Test Gift',
      items:     [],
      creatures: [],
      eggs:      [],
      canBeClaimed: vi.fn().mockReturnValue({ canClaim: true }),
      ...overrides,
    });

    it('returns an error when neither code nor giftId is provided', async () => {
      const result = await service.claim('p1', {});
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Provide either');
    });

    it('claims an internet gift by giftId', async () => {
      const gift = makeGift();
      mockFindOne.mockResolvedValue(gift);
      mockFindByIdAndUpdate.mockResolvedValue({});

      const result = await service.claim('p1', { giftId: 'gift-abc' });
      expect(result.ok).toBe(true);
      expect(result.gift?.giftId).toBe('gift-abc');
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'gift-mongo-id',
        { $addToSet: { claimedBy: 'p1' } },
      );
    });

    it('claims a code gift by code (case-insensitive)', async () => {
      const gift = makeGift({ type: 'code', code: 'LAUNCH2024' });
      mockFindOne.mockResolvedValue(gift);
      mockFindByIdAndUpdate.mockResolvedValue({});

      const result = await service.claim('p1', { code: 'launch2024' });
      expect(result.ok).toBe(true);
      // Lookup must use uppercased code
      expect(mockFindOne).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'LAUNCH2024' }),
      );
    });

    it('returns an error when gift is not found', async () => {
      mockFindOne.mockResolvedValue(null);
      const result = await service.claim('p1', { giftId: 'ghost' });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Gift not found.');
    });

    it('returns an error when canBeClaimed returns false', async () => {
      const gift = makeGift({
        canBeClaimed: vi.fn().mockReturnValue({ canClaim: false, reason: 'Already claimed.' }),
      });
      mockFindOne.mockResolvedValue(gift);
      const result = await service.claim('p1', { giftId: 'gift-abc' });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Already claimed.');
      expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns full contents (items, creatures, eggs) on success', async () => {
      const gift = makeGift({
        items:     [{ id: 'potion', count: 3 }],
        creatures: [{ id: 'pikachu', level: 25 }],
        eggs:      [],
      });
      mockFindOne.mockResolvedValue(gift);
      mockFindByIdAndUpdate.mockResolvedValue({});

      const result = await service.claim('p1', { giftId: 'gift-abc' });
      expect(result.gift?.items).toEqual([{ id: 'potion', count: 3 }]);
      expect(result.gift?.creatures).toEqual([{ id: 'pikachu', level: 25 }]);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates an internet gift successfully', async () => {
      const created = { giftId: 'gift-new', title: 'New Gift', type: 'internet' };
      mockCreate.mockResolvedValue({ toObject: () => created });

      const result = await service.create({ title: 'New Gift', type: 'internet' });
      expect(result).toEqual(created);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('creates a code gift with normalised uppercase code', async () => {
      mockExists.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ toObject: () => ({ giftId: 'g2' }) });

      await service.create({ title: 'Code Gift', type: 'code', code: 'launch2024' });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'LAUNCH2024' }),
      );
    });

    it('throws when type is code but no code is provided', async () => {
      await expect(service.create({ title: 'Bad', type: 'code' })).rejects.toThrow('code is required');
    });

    it('throws when a gift with the same code already exists', async () => {
      mockExists.mockResolvedValue({ _id: 'existing' });
      await expect(
        service.create({ title: 'Dup', type: 'code', code: 'LAUNCH2024' }),
      ).rejects.toThrow('already exists');
    });
  });

  // ── deactivate ─────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('sets isActive to false and returns ok: true', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ giftId: 'g1' });
      const result = await service.deactivate('g1');
      expect(result.ok).toBe(true);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { giftId: 'g1' },
        { isActive: false },
      );
    });

    it('returns an error when gift is not found', async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);
      const result = await service.deactivate('ghost');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Gift not found.');
    });
  });

  // ── purgeExpired ───────────────────────────────────────────────────────────

  describe('purgeExpired', () => {
    it('deletes expired non-permanent gifts and returns count', async () => {
      mockDeleteMany.mockResolvedValue({ deletedCount: 3 });
      const count = await service.purgeExpired();
      expect(count).toBe(3);
      expect(mockDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ alwaysAvailable: false, validTo: expect.anything() }),
      );
    });

    it('returns 0 when no gifts were deleted', async () => {
      mockDeleteMany.mockResolvedValue({ deletedCount: 0 });
      const count = await service.purgeExpired();
      expect(count).toBe(0);
    });
  });
});
