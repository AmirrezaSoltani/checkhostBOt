import mongoose from 'mongoose';

const statusEnum = ['up', 'down', 'unknown'];
const typeEnum = ['url', 'ip'];
const checkMethodEnum = ['http', 'ping', 'tcp'];

const targetSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    type: { type: String, enum: typeEnum, required: true },
    address: { type: String, required: true },
    checkMethod: { type: String, enum: checkMethodEnum },
    tcpPort: { type: Number },
    intervalSeconds: { type: Number },
    enabled: { type: Boolean, default: true },
    // Last check result
    lastStatus: { type: String, enum: statusEnum, default: 'unknown' },
    lastCheckedAt: { type: Date },
    lastChangeAt: { type: Date },
    lastLatencyMs: { type: Number },
    lastHttpStatus: { type: Number },
    lastError: { type: String },
  },
  { timestamps: true }
);

targetSchema.index({ enabled: 1 });
targetSchema.index({ type: 1, address: 1 }, { unique: true });

export const Target = mongoose.model('Target', targetSchema);
