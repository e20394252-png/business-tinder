const TelegramBot = require('node-telegram-bot-api');

let botInstance = null;

function initBot() {
  if (botInstance) return botInstance;
  
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.warn('⚠️  BOT_TOKEN not set, bot features disabled');
    return null;
  }
  
  // Use polling in dev, webhook can be set up for production
  botInstance = new TelegramBot(token, { polling: true });
  
  // /start command
  botInstance.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'друг';
    
    botInstance.sendMessage(chatId, 
      `👋 Привет, ${firstName}!\n\n` +
      `Добро пожаловать в **Business Tinder** — деловой нетворкинг нового поколения.\n\n` +
      `Свайпай профили, находи единомышленников и деловых партнёров! 🤝\n\n` +
      `Нажми кнопку ниже, чтобы открыть приложение 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🚀 Открыть Business Tinder',
              web_app: { url: process.env.WEBAPP_URL || 'https://example.com' }
            }
          ]]
        }
      }
    );
  });
  
  console.log('🤖 Telegram bot initialized');
  return botInstance;
}

/**
 * Send match notification to a user
 */
async function sendMatchNotification(telegramId, matchedUser) {
  if (!botInstance) return;
  
  const name = [matchedUser.firstName, matchedUser.lastName]
    .filter(Boolean)
    .join(' ') || matchedUser.username || 'Кто-то';
  
  try {
    await botInstance.sendMessage(telegramId.toString(),
      `🎉 У вас новый мэтч!\n\n` +
      `**${name}** тоже хочет с вами познакомиться!\n\n` +
      `Откройте приложение, чтобы посмотреть мэтчи 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '💼 Посмотреть мэтчи',
              web_app: { url: process.env.WEBAPP_URL || 'https://example.com' }
            }
          ]]
        }
      }
    );
  } catch (err) {
    console.error(`Failed to send notification to ${telegramId}:`, err.message);
  }
}

module.exports = { initBot, sendMatchNotification };
