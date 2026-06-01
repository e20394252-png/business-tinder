const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/profiles/next
 * Returns the next profile card to swipe on.
 * Excludes: self, already swiped users.
 */
router.get('/next', authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const tgUser = req.telegramUser;
    
    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) }
    });
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found. Please auth first.' });
    }
    
    // Get IDs of users already swiped
    const swipedIds = await prisma.swipe.findMany({
      where: { swiperId: currentUser.id },
      select: { targetId: true }
    });
    
    const excludeIds = [currentUser.id, ...swipedIds.map(s => s.targetId)];
    
    // Find next unswiped user who has a bio (i.e. a proper profile from the channel)
    const nextProfile = await prisma.user.findFirst({
      where: {
        id: { notIn: excludeIds },
        bio: { not: null }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (!nextProfile) {
      return res.json({ profile: null, message: 'Больше нет профилей для просмотра' });
    }
    
    res.json({
      profile: {
        id: nextProfile.id,
        firstName: nextProfile.firstName,
        lastName: nextProfile.lastName,
        username: nextProfile.username,
        photoUrl: nextProfile.photoUrl,
        bio: nextProfile.bio
      }
    });
  } catch (err) {
    console.error('Profiles error:', err);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

/**
 * GET /api/profiles/me
 * Returns current user's own profile
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const tgUser = req.telegramUser;
    
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
    console.error('Profile me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/profiles/settings
 * Update user settings (notifyOnMatch)
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const tgUser = req.telegramUser;
    const { notifyOnMatch } = req.body;
    
    const user = await prisma.user.update({
      where: { telegramId: BigInt(tgUser.id) },
      data: {
        notifyOnMatch: typeof notifyOnMatch === 'boolean' ? notifyOnMatch : undefined
      }
    });
    
    res.json({
      notifyOnMatch: user.notifyOnMatch
    });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
