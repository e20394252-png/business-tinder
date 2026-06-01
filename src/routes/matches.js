const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/matches
 * Returns all matches for the current user with profile data
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const tgUser = req.telegramUser;
    
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) }
    });
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find all matches where current user is either user1 or user2
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: currentUser.id },
          { user2Id: currentUser.id }
        ]
      },
      include: {
        user1: true,
        user2: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map to return the OTHER user's info
    const matchList = matches.map(match => {
      const otherUser = match.user1Id === currentUser.id ? match.user2 : match.user1;
      return {
        matchId: match.id,
        matchedAt: match.createdAt,
        user: {
          id: otherUser.id,
          telegramId: otherUser.telegramId.toString(),
          username: otherUser.username,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          photoUrl: otherUser.photoUrl,
          bio: otherUser.bio
        }
      };
    });
    
    res.json({ matches: matchList });
  } catch (err) {
    console.error('Matches error:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;
