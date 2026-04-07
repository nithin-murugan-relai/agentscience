import { createClient } from "redis";

const globalForRedis = globalThis as unknown as {
  redisClient: AppRedisClient | undefined;
  redisClientPromise: Promise<AppRedisClient | null> | undefined;
};

function createRedisClient() {
  const url = process.env.REDIS_URL;

  if (!url) {
    return null;
  }

  const client = createClient({
    url,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    },
  });

  client.on("error", (error) => {
    console.error("Redis client error", error);
  });

  return client;
}

type AppRedisClient = NonNullable<ReturnType<typeof createRedisClient>>;

export async function getRedisClient() {
  if (globalForRedis.redisClient?.isOpen) {
    return globalForRedis.redisClient;
  }

  if (globalForRedis.redisClientPromise) {
    return globalForRedis.redisClientPromise;
  }

  const client = createRedisClient();

  if (!client) {
    return null;
  }

  globalForRedis.redisClientPromise = client
    .connect()
    .then(() => {
      globalForRedis.redisClient = client;
      return client;
    })
    .catch((error) => {
      console.error("Failed to connect to Redis", error);
      client.destroy();
      globalForRedis.redisClient = undefined;
      return null;
    })
    .finally(() => {
      globalForRedis.redisClientPromise = undefined;
    });

  return globalForRedis.redisClientPromise;
}
