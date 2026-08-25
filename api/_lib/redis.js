// Общий клиент Upstash Redis (REST — без постоянного соединения, что и нужно
// для serverless-функций Vercel). Переменные KV_REST_API_URL/KV_REST_API_TOKEN
// добавлены автоматически при подключении базы данных Upstash к проекту в Vercel —
// именно эти имена, а не стандартные UPSTASH_REDIS_REST_*, поэтому Redis.fromEnv()
// тут не сработал бы, и клиент собирается вручную.

import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
