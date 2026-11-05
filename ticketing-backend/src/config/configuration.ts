export default () => ({
  port: parseInt(process.env.PORT || '3002', 10),
  database: {
    uri: process.env.MONGODB_URI,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION,
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION,
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION, 10),
  },
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
  mail: {
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT, 10),
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
  },
  tokens: {
    emailVerificationExpiration: process.env.EMAIL_VERIFICATION_EXPIRATION,
    passwordResetExpiration: process.env.PASSWORD_RESET_EXPIRATION,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
});
