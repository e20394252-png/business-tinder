const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

/**
 * POST /api/auth
 * Validates Telegram initData and returns/creates user profile
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const tgUser = req.telegramUser;
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(tgUser.id),
          username: tgUser.username || null,
          firstName: tgUser.first_name || null,
          lastName: tgUser.last_name || null,
          photoUrl: tgUser.photo_url || null
        }
      });
    } else {
      // Update basic info from Telegram on each login
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: tgUser.username || user.username,
          firstName: tgUser.first_name || user.firstName,
          lastName: tgUser.last_name || user.lastName
        }
      });
    }
    
    res.json({
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      bio: user.bio,
      notifyOnMatch: user.notifyOnMatch
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
