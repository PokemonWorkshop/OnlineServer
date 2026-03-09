/**
 * Tests for src/services/BankService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BankService } from '../../src/services/BankService';

const mockFind           = vi.fn();
const mockFindOne        = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockCreate         = vi.fn();

vi.mock('../../src/models/BankBox', () => ({
  BankBox: {
    find:              (...a: any[]) => mockFind(...a),
    findOne:           (...a: any[]) => mockFindOne(...a),
    findByIdAndUpdate: (...a: any[]) => mockFindByIdAndUpdate(...a),
    create:            (...a: any[]) => mockCreate(...a),
  },
}));

describe('BankService', () => {
  let service: BankService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BankService();
  });

  describe('getBoxes', () => {
    it('returns the player boxes', async () => {
      const boxes = [{ boxIndex: 0, slots: [] }];
      mockFind.mockReturnValue({ lean: () => Promise.resolve(boxes) });
      const result = await service.getBoxes('player1');
      expect(result).toEqual(boxes);
      expect(mockFind).toHaveBeenCalledWith({ playerId: 'player1' });
    });

    it('returns an empty array when the player has no boxes', async () => {
      mockFind.mockReturnValue({ lean: () => Promise.resolve([]) });
      const result = await service.getBoxes('player1');
      expect(result).toEqual([]);
    });
  });

  describe('depositCreature', () => {
    it('creates a new box document when no box exists yet', async () => {
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      mockCreate.mockResolvedValue({});
      const result = await service.depositCreature('player1', 0, 0, { speciesId: '001' });
      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('pushes to an existing box when the slot is free', async () => {
      const existingBox = { _id: 'box-id', slots: [] };
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(existingBox) });
      mockFindByIdAndUpdate.mockResolvedValue({});
      const result = await service.depositCreature('player1', 0, 3, { speciesId: '004' });
      expect(result.ok).toBe(true);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'box-id',
        expect.objectContaining({ $push: expect.anything() }),
      );
    });

    it('returns an error when the slot is already occupied', async () => {
      const box = { _id: 'box-id', slots: [{ slotIndex: 2, creature: {} }] };
      mockFindOne.mockReturnValue({ lean: () => Promise.resolve(box) });
      const result = await service.depositCreature('player1', 0, 2, { speciesId: '007' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('already occupied');
    });

    it('returns an error when boxIndex is out of range', async () => {
      const result = await service.depositCreature('player1', 99, 0, { speciesId: '001' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid box index');
    });

    it('returns an error when boxIndex is negative', async () => {
      const result = await service.depositCreature('player1', -1, 0, { speciesId: '001' });
      expect(result.ok).toBe(false);
    });

    it('returns an error when slotIndex is out of range', async () => {
      const result = await service.depositCreature('player1', 0, 99, { speciesId: '001' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid slot index');
    });
  });

  describe('withdrawCreature', () => {
    it('withdraws a creature and removes it from the slot', async () => {
      const creature = { speciesId: '001', level: 5 };
      const box = {
        _id:   'box-id',
        slots: [{ slotIndex: 1, creature }],
        find:  (fn: any) => [{ slotIndex: 1, creature }].find(fn),
      };
      mockFindOne.mockResolvedValue(box);
      mockFindByIdAndUpdate.mockResolvedValue({});
      const result = await service.withdrawCreature('player1', 0, 1);
      expect(result.ok).toBe(true);
      expect(result.creature).toEqual(creature);
    });

    it('returns an error when the box does not exist', async () => {
      mockFindOne.mockResolvedValue(null);
      const result = await service.withdrawCreature('player1', 0, 0);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('empty or does not exist');
    });

    it('returns an error when the slot is empty', async () => {
      const box = {
        _id:   'box-id',
        slots: [],
        find:  () => undefined,
      };
      mockFindOne.mockResolvedValue(box);
      const result = await service.withdrawCreature('player1', 0, 5);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('slot is empty');
    });
  });
});
