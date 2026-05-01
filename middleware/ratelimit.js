const { Ratelimit } = require("@upstash/ratelimit");
const { Redis } = require("@upstash/redis");

let redisClient = null;
let ratelimitAuth = null;
let ratelimitWa = null;
let ratelimitKiwify = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = Redis.fromEnv();
    ratelimitAuth = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, '15 m')
    });
    ratelimitWa = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, '1 s')
    });
    ratelimitKiwify = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(60, '1 m')
    });
  }
} catch (e) {
  console.error("Erro inicializando Upstash Ratelimit:", e.message);
}

module.exports = {
  checkAuthRateLimit: async (req, res, next) => {
    if (!ratelimitAuth) return next();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const { success, reset } = await ratelimitAuth.limit(`login:${ip}`);
    
    if (!success) {
      const waitMinutes = Math.ceil((reset - Date.now()) / 1000 / 60);
      res.setHeader('Retry-After', waitMinutes * 60);
      return res.status(429).json({ error: `Muitas tentativas de login. Tente novamente em ${waitMinutes} minutos.` });
    }
    next();
  },
  checkWaRateLimit: async (req, res, next) => {
    if (!ratelimitWa) return next();
    const token = req.params.token || 'global';
    const { success } = await ratelimitWa.limit(`wa:${token}`);
    
    if (!success) {
      return res.status(429).json({ error: "Rate limit excedido para envios de WhatsApp." });
    }
    next();
  },
  checkKiwifyRateLimit: async (req, res, next) => {
    if (!ratelimitKiwify) return next();
    const wsId = req.params.wsId || 'global';
    const { success } = await ratelimitKiwify.limit(`kiwify:${wsId}`);
    
    if (!success) {
      return res.status(429).json({ error: "Rate limit excedido para webhooks da Kiwify." });
    }
    next();
  }
};
