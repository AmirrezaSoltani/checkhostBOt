import mongoose from 'mongoose';

const statusEnum = ['up', 'down', 'unknown'];

const eventSchema = new mongoose.Schema(
  {
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Target', required: true },
    fromStatus: { type: String, enum: statusEnum },
    toStatus: { type: String, enum: statusEnum, required: true },
    at: { type: Date, default: Date.now },
    latencyMs: { type: Number },
    httpStatus: { type: Number },
    error: { type: String },
  },
  { timestamps: true }
);

eventSchema.index({ targetId: 1, at: -1 });
eventSchema.index({ at: -1 });

export const Event = mongoose.model('Event', eventSchema);
