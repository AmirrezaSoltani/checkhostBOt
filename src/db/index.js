import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export async function connectDb() {
  try {
    await mongoose.connect(config.MONGO_URI);
    logger.info({ uri: config.MONGO_URI.replace(/:[^:@]+@/, ':***@') }, 'MongoDB connected');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export { Target } from './models/Target.js';
export { Subscription } from './models/Subscription.js';
export { Event } from './models/Event.js';
