/**
 * Redis Service for KAIROS persistence
 *
 * Provides Redis-based persistence for game data and other shared state.
 * Uses configurable key prefix (default: 'kb:') via KAIROS_REDIS_PREFIX env var for isolation.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';
import { REDIS_URL, KAIROS_REDIS_PREFIX } from '../config.js';

export class RedisService {
    private client: RedisClientType;
    private readonly prefix: string;
    private connected = false;
    private readonly redisUrl: string;

    constructor() {
        const redisUrl = REDIS_URL;
        this.redisUrl = redisUrl;
        this.prefix = KAIROS_REDIS_PREFIX;

        logger.debug(
            `[RedisService] Initializing with REDIS_URL="${redisUrl}" and KAIROS_REDIS_PREFIX="${this.prefix}"`
        );

        this.client = createClient({
            url: redisUrl
        });

        this.client.on('error', (err: any) => {
            logger.error('Redis Client Error', err);
            logger.debug(
                `[RedisService] Error details: ${err?.message || err} | code=${(err && err.code) || 'n/a'} ` +
                `errno=${(err && err.errno) || 'n/a'} address=${(err && err.address) || 'n/a'} ` +
                `port=${(err && err.port) || 'n/a'} target="${this.redisUrl}"`
            );

            // If this is an AggregateError, log each inner error for deep diagnostics
            const innerErrors: any[] | undefined =
                err && typeof err === 'object' && 'errors' in err ? (err as any).errors : undefined;
            if (Array.isArray(innerErrors) && innerErrors.length > 0) {
                innerErrors.forEach((inner, index) => {
                    logger.debug(
                        `[RedisService] Inner error[${index}] code=${inner?.code || 'n/a'} ` +
                        `errno=${inner?.errno || 'n/a'} address=${inner?.address || 'n/a'} ` +
                        `port=${inner?.port || 'n/a'} message=${inner?.message || inner}`
                    );
                });
            }
        });

        this.client.on('connect', () => {
            logger.info('Connecting to Redis...');
            logger.debug(`[RedisService] Attempting connection to ${redisUrl}`);
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready');
            logger.debug('[RedisService] Redis client is ready and operational');
            this.connected = true;
        });

        this.client.on('end', () => {
            logger.info('Redis connection closed');
            logger.debug('[RedisService] Redis connection ended');
            this.connected = false;
        });
    }

    async connect(): Promise<void> {
        if (!this.connected) {
            logger.info(
                `[RedisService] connect() called, attempting connection to "${this.redisUrl}"`
            );
            try {
                await this.client.connect();
            } catch (error) {
                logger.error(
                    `[RedisService] connect() failed for "${this.redisUrl}"`,
                    error
                );
                throw error;
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.quit();
        }
    }

    private getKey(key: string): string {
        return `${this.prefix}${key}`;
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(this.getKey(key));
        } catch (error) {
            logger.error(`Redis GET error for key ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        try {
            if (ttl) {
                await this.client.setEx(this.getKey(key), ttl, value);
            } else {
                await this.client.set(this.getKey(key), value);
            }
        } catch (error) {
            logger.error(`Redis SET error for key ${key}:`, error);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(this.getKey(key));
        } catch (error) {
            logger.error(`Redis DEL error for key ${key}:`, error);
        }
    }

    async hget(hash: string, field: string): Promise<string | null> {
        try {
            return await this.client.hGet(this.getKey(hash), field);
        } catch (error) {
            logger.error(`Redis HGET error for hash ${hash} field ${field}:`, error);
            return null;
        }
    }

    async hset(hash: string, field: string, value: string): Promise<void> {
        try {
            await this.client.hSet(this.getKey(hash), field, value);
        } catch (error) {
            logger.error(`Redis HSET error for hash ${hash} field ${field}:`, error);
        }
    }

    async hgetall(hash: string): Promise<Record<string, string> | null> {
        try {
            return await this.client.hGetAll(this.getKey(hash));
        } catch (error) {
            logger.error(`Redis HGETALL error for hash ${hash}:`, error);
            return null;
        }
    }

    async hsetall(hash: string, data: Record<string, string>): Promise<void> {
        try {
            await this.client.hSet(this.getKey(hash), data);
        } catch (error) {
            logger.error(`Redis HSETALL error for hash ${hash}:`, error);
        }
    }

    async incr(key: string): Promise<number> {
        try {
            return await this.client.incr(this.getKey(key));
        } catch (error) {
            logger.error(`Redis INCR error for key ${key}:`, error);
            return 0;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.client.exists(this.getKey(key));
            return result === 1;
        } catch (error) {
            logger.error(`Redis EXISTS error for key ${key}:`, error);
            return false;
        }
    }

    async keys(pattern: string): Promise<string[]> {
        try {
            return await this.client.keys(this.getKey(pattern));
        } catch (error) {
            logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
            return [];
        }
    }

    /**
     * Publish a message to a Redis channel (pub/sub)
     * Note: Channel names are NOT prefixed to allow cross-instance communication
     * @param channel Channel name to publish to
     * @param message Message to publish
     * @returns Number of subscribers that received the message
     */
    async publish(channel: string, message: string): Promise<number> {
        try {
            const result = await this.client.publish(channel, message);
            logger.debug(`[RedisService] Published message to channel "${channel}", ${result} subscribers notified`);
            return result;
        } catch (error) {
            logger.error(`Redis PUBLISH error for channel ${channel}:`, error);
            return 0;
        }
    }

    // Utility methods for JSON objects
    async getJson<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch (error) {
            logger.error(`JSON parse error for key ${key}:`, error);
            return null;
        }
    }

    async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
        try {
            const jsonValue = JSON.stringify(value);
            await this.set(key, jsonValue, ttl);
        } catch (error) {
            logger.error(`JSON stringify error for key ${key}:`, error);
        }
    }

    async hgetJson<T>(hash: string, field: string): Promise<T | null> {
        const value = await this.hget(hash, field);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch (error) {
            logger.error(`JSON parse error for hash ${hash} field ${field}:`, error);
            return null;
        }
    }

    async hsetJson<T>(hash: string, field: string, value: T): Promise<void> {
        try {
            const jsonValue = JSON.stringify(value);
            await this.hset(hash, field, jsonValue);
        } catch (error) {
            logger.error(`JSON stringify error for hash ${hash} field ${field}:`, error);
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

export const redisService = new RedisService();
