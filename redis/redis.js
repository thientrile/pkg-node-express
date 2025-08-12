/** @format */

"use strict";

import { createClient } from "redis";
// NOTE: Replaced custom dbLogger with native console logging
const Consts={
    REDIS_CONNECT_TIMEOUT: 100000,
  REDIS_CONNECT_MESSAGE: {
    code: -99,
    message: {
      vn: "Kết nối tới Redis thất bại",
      en: "Connect to Redis failed",
    },
  },
}
const RedisStatus = {
  CONNECT: "connect",
  END: "end",
  RECONNECT: "reconnecting",
  ERROR: "error",
};

let retryCount = 0;
const maxRetries = Consts.Retry || 3;
let connectionTimeout;

const redisClient = {
  instance: null,
};

const forceCloseConnection = async () => {
  try {
    if (redisClient.instance?.isOpen) {
      await redisClient.instance.disconnect();
      console.log("[Redis][FORCE_CLOSE] disconnect", {
        reason: "force_close_initiated",
        connectionState: "closed",
      });
    }
  } catch (error) {
    console.error("[Redis][FORCE_CLOSE][ERROR]", error?.message, {
      operation: "force_disconnect",
      graceful: false,
    });
  } finally {
    redisClient.instance = null;
    retryCount = 0;
    clearTimeout(connectionTimeout);
  }
};

const handleTimeoutError = () => {
  connectionTimeout = setTimeout(async () => {
    console.error("[Redis][TIMEOUT]", Consts.REDIS_CONNECT_MESSAGE.message.en, {
      code: Consts.REDIS_CONNECT_MESSAGE.code,
      timeout: Consts.REDIS_CONNECT_TIMEOUT,
      reason: "connection_timeout",
    });
    await forceCloseConnection();
    throw new RedisErrorRespoint(
      Consts.REDIS_CONNECT_MESSAGE.message.en,
      Consts.REDIS_CONNECT_MESSAGE.code
    );
  }, Consts.REDIS_CONNECT_TIMEOUT);
};

const handleRedisEvents = (instance) => {
  instance.on(RedisStatus.CONNECT, () => {
  console.log("[Redis][CONNECT] connected");
    retryCount = 0;
    clearTimeout(connectionTimeout);
  });

  instance.on(RedisStatus.END, () => {
  console.log("[Redis][END] disconnected");
  });

  instance.on(RedisStatus.RECONNECT, () => {
    retryCount++;
  console.log("[Redis][RECONNECT] attempt", retryCount + 1);

    if (retryCount >= maxRetries) {
      console.error("[Redis][RECONNECT][ERROR] Max retries exceeded", {
        retryCount,
        maxRetries,
        finalAttempt: true,
        errorSource: "reconnect_max_retries_exceeded",
      });
      setTimeout(forceCloseConnection, 1000);
      return;
    }

    console.log("[Redis][RECONNECT] attempt detail", {
      attempt: retryCount,
      maxRetries,
      retryStatus: `${retryCount}/${maxRetries}`,
      source: "reconnect_event",
    });

    handleTimeoutError();
  });

  instance.on(RedisStatus.ERROR, (err) => {
    retryCount++;
    console.error("[Redis][ERROR]", err?.message, {
      retryCount,
      maxRetries,
      retryAttempt: `${retryCount}/${maxRetries}`,
      errorSource: "event_handler",
    });

    if (retryCount >= maxRetries) {
      console.error("[Redis][ERROR] Max retries exceeded", {
        retryCount,
        maxRetries,
        finalAttempt: true,
        errorSource: "error_max_retries_exceeded",
      });
      setTimeout(forceCloseConnection, 1000);
      return;
    }

    handleTimeoutError();
  });
};

const initRedis = (config) => {
  const { host, port, user, pass } = config;
  const hasAuth = user && pass;
  const redisUrl = hasAuth
    ? `redis://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}`
    : `redis://${host}`;

  if (!global.RedisClient) {
    const instance = createClient({ url: redisUrl });
    redisClient.instance = instance;
    handleRedisEvents(instance);

    const connect = async () => {
      try {
        console.log("[Redis][INIT] Initial Connection Attempt", {
          attempt: 1,
          maxRetries,
        });
        await instance.connect();
      } catch (err) {
        console.error("[Redis][INIT][ERROR]", err?.message, {
          errorSource: "initial_connection_attempt",
          willRetryViaEvents: true,
        });
      }
    };

    connect();
    global.RedisClient = redisClient.instance;
  }

  return global.RedisClient;
};


const closeRedis = async () => {
  try {
    if (redisClient.instance?.isOpen) {
      await redisClient.instance.quit();
  console.log("[Redis][QUIT] disconnected");
    } else {
  console.log("[Redis][CLOSE] No active connection to close");
    }
  } catch (error) {
    console.error("[Redis][CLOSE][ERROR]", error?.message, {
      operation: "disconnect",
      graceful: false,
    });
  } finally {
    redisClient.instance = null;
    retryCount = 0;
  }
};

const getRetryInfo = () => ({
  current: retryCount,
  max: maxRetries,
  remaining: maxRetries - retryCount,
  status: `${retryCount}/${maxRetries}`,
});

const resetRetryCount = () => {
  retryCount = 0;
  console.log("[Redis][RETRY][RESET]", { action: "retry_count_reset", newCount: retryCount });
};

const isConnected = () => redisClient.instance?.isOpen;

export {
  initRedis,
  closeRedis,
  getRetryInfo,
  resetRetryCount,
  isConnected,
  forceCloseConnection,
};
