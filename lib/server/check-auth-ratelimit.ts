import { getRedis } from "./redis"

var AUTH_PREFIX = "auth_ratelimit:"
var MAX_LOGIN_ATTEMPTS = 7
var MAX_SIGNUP_ATTEMPTS = 5
var MAX_PASSWORD_RESET_ATTEMPTS = 3
var AUTH_WINDOW_SIZE_MS = 15 * 60 * 1000 // 15 minutes
var PASSWORD_RESET_WINDOW_SIZE_MS = 60 * 60 * 1000 // 1 hour

export async function checkAuthRateLimit(
  email: string,
  ip: string,
  action: "login" | "signup" | "password-reset"
): Promise<{ success: boolean }> {
  var redis = getRedis()
  var now = Date.now()
  var windowSize =
    action === "password-reset"
      ? PASSWORD_RESET_WINDOW_SIZE_MS
      : AUTH_WINDOW_SIZE_MS
  var windowStart = now - windowSize

  var emailKey = `${AUTH_PREFIX}${action}:email:${email}`
  var ipKey = `${AUTH_PREFIX}${action}:ip:${ip}`

  var pipeline = redis.pipeline()
  pipeline.zremrangebyscore(emailKey, 0, windowStart)
  pipeline.zcard(emailKey)
  pipeline.zremrangebyscore(ipKey, 0, windowStart)
  pipeline.zcard(ipKey)

  var [, emailCount, , ipCount] = (await pipeline.exec()) as [
    any,
    number,
    any,
    number
  ]

  let maxAttempts: number
  switch (action) {
    case "login":
      maxAttempts = MAX_LOGIN_ATTEMPTS
      break
    case "signup":
      maxAttempts = MAX_SIGNUP_ATTEMPTS
      break
    case "password-reset":
      maxAttempts = MAX_PASSWORD_RESET_ATTEMPTS
      break
  }

  var isAllowed = emailCount < maxAttempts && ipCount < maxAttempts

  if (isAllowed) {
    // Only add new score if the limit hasn't been reached
    pipeline.zadd(emailKey, { score: now, member: now.toString() })
    pipeline.zadd(ipKey, { score: now, member: now.toString() })
    pipeline.expire(emailKey, Math.ceil(windowSize / 1000))
    pipeline.expire(ipKey, Math.ceil(windowSize / 1000))
    await pipeline.exec()
  }

  return { success: isAllowed }
}
