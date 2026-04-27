import { Schema, model, Document } from 'mongoose';

export interface MaintenanceStateData {
  key: string;
  enabled: boolean;
  message: string;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMaintenanceState extends MaintenanceStateData, Document {}

const MaintenanceStateSchema = new Schema<IMaintenanceState>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    enabled: { type: Boolean, default: false },
    message: { type: String, default: '', trim: true, maxlength: 500 },
    endAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const MaintenanceState = model<IMaintenanceState>(
  'MaintenanceState',
  MaintenanceStateSchema,
);
