import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    notifyOnUp: { type: Boolean, default: true },
    notifyOnDown: { type: Boolean, default: true },
    onlyChanges: { type: Boolean, default: true },
    includeLatency: { type: Boolean, default: true },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '23:00' },
      end: { type: String, default: '07:00' },
    },
    targetFilter: {
      mode: { type: String, enum: ['all', 'selected'], default: 'all' },
      targetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Target' }],
    },
  },
  { timestamps: true }
);


subscriptionSchema.index({ enabled: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
