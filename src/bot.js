const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

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
  
  // /start command — premium welcome with banner
  botInstance.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'друг';
    
    // Send welcome banner image
    const bannerPath = path.join(__dirname, '..', 'assets', 'welcome-banner.png');
    if (fs.existsSync(bannerPath)) {
      try {
        await botInstance.sendPhoto(chatId, fs.createReadStream(bannerPath), {
          caption: `✨ *Business Tinder* — деловой нетворкинг нового поколения`,
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Failed to send banner:', err.message);
      }
    }
    
    // Send welcome message
    const welcomeText = 
      `👋 Привет, *${firstName}*!\n\n` +
      `Рад видеть тебя в *Business Tinder* — пространстве, где рождаются сильные деловые связи.\n\n` +
      `🔥 *Как это работает:*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `🃏 Листай карточки профессионалов\n` +
      `❤️ Свайпни вправо, если интересен человек\n` +
      `🤝 При взаимном интересе — это мэтч!\n` +
      `✉️ Пиши в личку и начинай сотрудничество\n\n` +
      `💡 *Что здесь можно найти:*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `• Партнёров для бизнеса\n` +
      `• Инвесторов и менторов\n` +
      `• Клиентов и подрядчиков\n` +
      `• Единомышленников для проектов\n\n` +
      `Твой профиль уже подготовлен — просто открой приложение и начни знакомиться! 🚀`;
    
    await botInstance.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{
            text: '🚀 Открыть Business Tinder',
            web_app: { url: process.env.WEBAPP_URL || 'https://example.com' }
          }],
          [{
            text: '❓ Как попасть в каталог',
            callback_data: 'how_to_join'
          }]
        ]
      }
    });
  });
  
  // Callback for "How to join" button
  botInstance.on('callback_query', async (query) => {
    if (query.data === 'how_to_join') {
      await botInstance.answerCallbackQuery(query.id);
      await botInstance.sendMessage(query.message.chat.id,
        `📋 *Как попасть в каталог Business Tinder?*\n\n` +
        `Твой профиль добавляется автоматически из специального канала.\n\n` +
        `Если тебя ещё нет — обратись к организатору, и он опубликует твою карточку с фото и описанием.\n\n` +
        `После публикации профиль появится в приложении, и другие участники смогут тебя найти! 🎯`,
        { parse_mode: 'Markdown' }
      );
    }
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
