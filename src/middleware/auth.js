const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateInitData(initData, botToken) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
  if (!hash) return null;
  
  // Remove hash from params and sort alphabetically
  urlParams.delete('hash');
  const dataCheckArr = [];
  urlParams.sort();
  urlParams.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });
  const dataCheckString = dataCheckArr.join('\n');
  
  // Create secret key: HMAC-SHA256 of bot token with "WebAppData" as key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  
  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  if (calculatedHash !== hash) return null;
  
  // Parse user data
  const userStr = urlParams.get('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Express middleware that validates Telegram initData from Authorization header.
 * Attaches user data to req.telegramUser
 */
function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  
  if (!initData) {
    return res.status(401).json({ error: 'Missing Telegram init data' });
  }
  
  const user = validateInitData(initData, process.env.BOT_TOKEN);
  
  if (!user) {
    // In development, allow bypass with mock data
    if (process.env.NODE_ENV === 'development' && initData === 'dev_bypass') {
      req.telegramUser = { id: 123456789, username: 'dev_user', first_name: 'Dev' };
      return next();
    }
    return res.status(401).json({ error: 'Invalid Telegram init data' });
  }
  
  req.telegramUser = user;
  next();
}

/**
 * Middleware for webhook routes — validates API key
 */
function webhookAuthMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
}

module.exports = { authMiddleware, webhookAuthMiddleware, validateInitData };
