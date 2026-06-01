const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { sendMatchNotification } = require('../bot');

/**
 * POST /api/swipe
 * Records a swipe action (LIKE or PASS).
 * If both users liked each other, creates a Match.
 * Body: { targetId: number, direction: "LIKE" | "PASS" }
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const tgUser = req.telegramUser;
    const { targetId, direction } = req.body;
    
    if (!targetId || !['LIKE', 'PASS'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid request. Need targetId and direction (LIKE/PASS)' });
    }
    
    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) }
    });
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (currentUser.id === targetId) {
      return res.status(400).json({ error: 'Cannot swipe yourself' });
    }
    
    // Check target exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId }
    });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    
    // Record the swipe (upsert to handle duplicates)
    await prisma.swipe.upsert({
      where: {
        swiperId_targetId: {
          swiperId: currentUser.id,
          targetId: targetId
        }
      },
      update: { direction },
      create: {
        swiperId: currentUser.id,
        targetId: targetId,
        direction: direction
      }
    });
    
    let isMatch = false;
    
    // Check for mutual like
    if (direction === 'LIKE') {
      const reverseSwipe = await prisma.swipe.findUnique({
        where: {
          swiperId_targetId: {
            swiperId: targetId,
            targetId: currentUser.id
          }
        }
      });
      
      if (reverseSwipe && reverseSwipe.direction === 'LIKE') {
        // Mutual like! Create match (use sorted IDs to prevent duplicates)
        const [user1Id, user2Id] = [currentUser.id, targetId].sort((a, b) => a - b);
        
        const existingMatch = await prisma.match.findUnique({
          where: {
            user1Id_user2Id: { user1Id, user2Id }
          }
        });
        
        if (!existingMatch) {
          await prisma.match.create({
            data: { user1Id, user2Id }
          });
          
          isMatch = true;
          
          // Send notifications if enabled
          if (currentUser.notifyOnMatch) {
            sendMatchNotification(currentUser.telegramId, targetUser);
          }
          if (targetUser.notifyOnMatch) {
            sendMatchNotification(targetUser.telegramId, currentUser);
          }
        }
      }
    }
    
    res.json({
      success: true,
      isMatch,
      matchedUser: isMatch ? {
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        username: targetUser.username,
        photoUrl: targetUser.photoUrl
      } : null
    });
  } catch (err) {
    console.error('Swipe error:', err);
    res.status(500).json({ error: 'Failed to process swipe' });
  }
});

module.exports = router;
