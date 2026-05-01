import { MaintenanceState } from '../models/MaintenanceState';
import { clients } from '../ws/clients';
import { send } from '../ws/types';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  endAt: string | null;
}

const DEFAULT_STATUS: MaintenanceStatus = {
  enabled: false,
  message: '',
  endAt: null,
};

export class MaintenanceService {
  async getStatus(): Promise<MaintenanceStatus> {
    const doc = await MaintenanceState.findOne({ key: 'global' }).lean();
    if (!doc) return DEFAULT_STATUS;

    return {
      enabled: doc.enabled,
      message: doc.message,
      endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null,
    };
  }

  async update(input: {
    enabled: boolean;
    message?: string;
    endAt?: Date | null;
  }): Promise<MaintenanceStatus> {
    const doc = await MaintenanceState.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          enabled: input.enabled,
          message: input.enabled ? (input.message ?? '').trim() : '',
          endAt: input.enabled ? (input.endAt ?? null) : null,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    const status: MaintenanceStatus = {
      enabled: doc.enabled,
      message: doc.message,
      endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null,
    };

    this.broadcast(status);
    return status;
  }

  async disable(): Promise<MaintenanceStatus> {
    return this.update({ enabled: false });
  }

  broadcast(status: MaintenanceStatus): void {
    for (const ws of clients.values()) {
      send(ws, 'MAINTENANCE_STATUS', status);
    }
  }
}

export const maintenanceService = new MaintenanceService();
