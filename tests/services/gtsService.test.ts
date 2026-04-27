/**
 * Tests for src/services/GtsService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GtsService } from '../../src/services/GtsService';

// ── Mock ENV ──────────────────────────────────────────────────────────────────

vi.mock('../../src/config/env', () => ({
  ENV: {
    GTS_SPECIES_BLACKLIST: ['150', '151'],
    GTS_EXPIRY_DAYS:       30,
  },
}));

// ── Mock GtsDeposit ───────────────────────────────────────────────────────────

const mockDepositFindOne         = vi.fn();
const mockDepositFindById        = vi.fn();
const mockDepositFindByIdDelete  = vi.fn();
const mockDepositFindOneDelete   = vi.fn();
const mockDepositCreate          = vi.fn();
const mockDepositFind            = vi.fn();

vi.mock('../../src/models/GtsDeposit', () => ({
  GtsDeposit: {
    findOne:          (...a: any[]) => mockDepositFindOne(...a),
    findById:         (...a: any[]) => mockDepositFindById(...a),
    findByIdAndDelete:(...a: any[]) => mockDepositFindByIdDelete(...a),
    findOneAndDelete: (...a: any[]) => mockDepositFindOneDelete(...a),
    create:           (...a: any[]) => mockDepositCreate(...a),
    find:             (...a: any[]) => mockDepositFind(...a),
  },
}));

// ── Mock GtsPendingResult ─────────────────────────────────────────────────────

const mockPendingCreate          = vi.fn();
const mockPendingFind            = vi.fn();
const mockPendingFindOneDelete   = vi.fn();

vi.mock('../../src/models/GtsPendingResult', () => ({
  GtsPendingResult: {
    create:           (...a: any[]) => mockPendingCreate(...a),
    find:             (...a: any[]) => mockPendingFind(...a),
    findOneAndDelete: (...a: any[]) => mockPendingFindOneDelete(...a),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GtsService', () => {
  let service: GtsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GtsService();
  });

  // ── deposit ────────────────────────────────────────────────────────────────

  describe('deposit', () => {
    const creature = { speciesId: '004', level: 5, trainerName: 'Ash' };
    const wanted   = { speciesId: '006' };

    it('creates a deposit and returns depositId', async () => {
      mockDepositFindOne.mockResolvedValue(null);
      mockDepositCreate.mockResolvedValue({ _id: 'dep-id' });

      const result = await service.deposit('p1', creature, wanted);
      expect(result.ok).toBe(true);
      expect(result.depositId).toBe('dep-id');
      expect(mockDepositCreate).toHaveBeenCalledOnce();
    });

    it('rejects when the deposited species is blacklisted', async () => {
      const result = await service.deposit('p1', { speciesId: '150' }, wanted);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('cannot be deposited');
      expect(mockDepositCreate).not.toHaveBeenCalled();
    });

    it('rejects when the wanted species is blacklisted', async () => {
      const result = await service.deposit('p1', creature, { speciesId: '151' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('cannot be requested');
    });

    it('rejects when the player already has an active deposit', async () => {
      mockDepositFindOne.mockResolvedValue({ _id: 'existing' });
      const result = await service.deposit('p1', creature, wanted);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('already have');
    });

    it('uses playerId as depositorName when trainerName is absent', async () => {
      mockDepositFindOne.mockResolvedValue(null);
      mockDepositCreate.mockResolvedValue({ _id: 'x' });
      await service.deposit('p1', { speciesId: '001' }, wanted);
      expect(mockDepositCreate).toHaveBeenCalledWith(
        expect.objectContaining({ depositorName: 'p1' }),
      );
    });

    it('defaults minLevel/maxLevel/gender when omitted', async () => {
      mockDepositFindOne.mockResolvedValue(null);
      mockDepositCreate.mockResolvedValue({ _id: 'x' });
      await service.deposit('p1', creature, { speciesId: '007' });
      expect(mockDepositCreate).toHaveBeenCalledWith(
        expect.objectContaining({ wantedMinLevel: 1, wantedMaxLevel: 100, wantedGender: -1 }),
      );
    });
  });

  // ── search ─────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('returns matching deposits without creature field', async () => {
      const deposits = [{ _id: 'dep1', wantedSpeciesId: '004' }];
      mockDepositFind.mockReturnValue({
        skip:  () => ({ limit: () => ({ select: () => ({ lean: () => Promise.resolve(deposits) }) }) }),
      });

      const result = await service.search('004', 15, 1);
      expect(result).toEqual(deposits);
      expect(mockDepositFind).toHaveBeenCalledWith(
        expect.objectContaining({ wantedSpeciesId: '004' }),
      );
    });

    it('passes page and limit to skip/limit', async () => {
      const skipMock  = vi.fn();
      const limitMock = vi.fn();
      limitMock.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
      skipMock.mockReturnValue({ limit: limitMock });
      mockDepositFind.mockReturnValue({ skip: skipMock });

      await service.search('004', 15, 1, 2, 10);
      expect(skipMock).toHaveBeenCalledWith(20);   // page 2 * limit 10
      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  // ── trade ──────────────────────────────────────────────────────────────────

  describe('trade', () => {
    const deposit = {
      _id:             'dep-id',
      depositorId:     'depositor',
      depositorName:   'Red',
      creature:        { speciesId: '006', level: 50 },
      wantedSpeciesId: '007',
      wantedMinLevel:  10,
      wantedMaxLevel:  60,
      wantedGender:    -1,
    };

    const offeredCreature = { speciesId: '007', level: 30, trainerName: 'Ash' };

    it('executes a valid trade and returns the deposited creature', async () => {
      mockDepositFindById.mockResolvedValue(deposit);
      mockDepositFindByIdDelete.mockResolvedValue({});
      mockPendingCreate.mockResolvedValue({});

      const result = await service.trade('trader', 'dep-id', offeredCreature);
      expect(result.ok).toBe(true);
      expect(result.receivedCreature).toEqual(deposit.creature);
    });

    it('creates a GtsPendingResult for the original depositor', async () => {
      mockDepositFindById.mockResolvedValue(deposit);
      mockDepositFindByIdDelete.mockResolvedValue({});
      mockPendingCreate.mockResolvedValue({});

      await service.trade('trader', 'dep-id', offeredCreature);
      expect(mockPendingCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId:      'depositor',
          receivedCreature: offeredCreature,
          traderName:       'Ash',
        }),
      );
    });

    it('returns an error when deposit is not found', async () => {
      mockDepositFindById.mockResolvedValue(null);
      const result = await service.trade('trader', 'missing', offeredCreature);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found or expired');
    });

    it('returns an error when trading with own deposit', async () => {
      mockDepositFindById.mockResolvedValue({ ...deposit, depositorId: 'trader' });
      const result = await service.trade('trader', 'dep-id', offeredCreature);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('yourself');
    });

    it('returns an error on species mismatch', async () => {
      mockDepositFindById.mockResolvedValue(deposit);
      const result = await service.trade('trader', 'dep-id', { speciesId: '001', level: 30 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('species');
    });

    it('returns an error when offered level is below wantedMinLevel', async () => {
      mockDepositFindById.mockResolvedValue(deposit);
      const result = await service.trade('trader', 'dep-id', { speciesId: '007', level: 5 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('level');
    });

    it('returns an error when offered level is above wantedMaxLevel', async () => {
      mockDepositFindById.mockResolvedValue(deposit);
      const result = await service.trade('trader', 'dep-id', { speciesId: '007', level: 99 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('level');
    });

    it('returns an error on gender mismatch when wantedGender is set', async () => {
      const depositWithGender = { ...deposit, wantedGender: 0 };
      mockDepositFindById.mockResolvedValue(depositWithGender);
      const result = await service.trade('trader', 'dep-id', { speciesId: '007', level: 30, gender: 1 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('gender');
    });

    it('accepts any gender when wantedGender is -1', async () => {
      mockDepositFindById.mockResolvedValue(deposit); // wantedGender: -1
      mockDepositFindByIdDelete.mockResolvedValue({});
      mockPendingCreate.mockResolvedValue({});
      const result = await service.trade('trader', 'dep-id', { speciesId: '007', level: 30, gender: 1 });
      expect(result.ok).toBe(true);
    });

    it('does not create a pending result when trade validation fails', async () => {
      mockDepositFindById.mockResolvedValue(deposit);
      await service.trade('trader', 'dep-id', { speciesId: 'wrong', level: 30 });
      expect(mockPendingCreate).not.toHaveBeenCalled();
    });
  });

  // ── withdraw ───────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('deletes the deposit and returns the creature', async () => {
      const creature = { speciesId: '004', level: 5 };
      mockDepositFindOneDelete.mockResolvedValue({ creature });
      const result = await service.withdraw('p1');
      expect(result.ok).toBe(true);
      expect(result.creature).toEqual(creature);
    });

    it('returns an error when no deposit exists', async () => {
      mockDepositFindOneDelete.mockResolvedValue(null);
      const result = await service.withdraw('p1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No active deposit');
    });
  });

  // ── getMyDeposit ───────────────────────────────────────────────────────────

  describe('getMyDeposit', () => {
    it('returns the deposit when it exists', async () => {
      const deposit = { depositorId: 'p1', wantedSpeciesId: '006' };
      mockDepositFindOne.mockReturnValue({ lean: () => Promise.resolve(deposit) });
      const result = await service.getMyDeposit('p1');
      expect(result).toEqual(deposit);
    });

    it('returns null when no deposit exists', async () => {
      mockDepositFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      const result = await service.getMyDeposit('p1');
      expect(result).toBeNull();
    });
  });

  // ── getPendingResults ──────────────────────────────────────────────────────

  describe('getPendingResults', () => {
    it('returns all pending results for the player', async () => {
      const results = [{ _id: 'r1', recipientId: 'p1', receivedCreature: {} }];
      mockPendingFind.mockReturnValue({ lean: () => Promise.resolve(results) });
      const r = await service.getPendingResults('p1');
      expect(r).toEqual(results);
      expect(mockPendingFind).toHaveBeenCalledWith({ recipientId: 'p1' });
    });

    it('returns an empty array when no pending results exist', async () => {
      mockPendingFind.mockReturnValue({ lean: () => Promise.resolve([]) });
      const r = await service.getPendingResults('p1');
      expect(r).toEqual([]);
    });
  });

  // ── claimPendingResult ─────────────────────────────────────────────────────

  describe('claimPendingResult', () => {
    it('deletes the pending result and returns the creature', async () => {
      const creature = { speciesId: '007', level: 20 };
      mockPendingFindOneDelete.mockResolvedValue({ receivedCreature: creature });
      const result = await service.claimPendingResult('p1', 'result-id');
      expect(result.ok).toBe(true);
      expect(result.creature).toEqual(creature);
      expect(mockPendingFindOneDelete).toHaveBeenCalledWith({
        _id:         'result-id',
        recipientId: 'p1',
      });
    });

    it('returns an error when the result does not exist', async () => {
      mockPendingFindOneDelete.mockResolvedValue(null);
      const result = await service.claimPendingResult('p1', 'ghost-id');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns an error when the result belongs to another player', async () => {
      // findOneAndDelete with wrong recipientId returns null
      mockPendingFindOneDelete.mockResolvedValue(null);
      const result = await service.claimPendingResult('wrong-player', 'result-id');
      expect(result.ok).toBe(false);
    });
  });
});
