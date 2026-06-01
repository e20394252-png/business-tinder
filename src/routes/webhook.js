const express = require('express');
const router = express.Router();
const { webhookAuthMiddleware } = require('../middleware/auth');

/**
 * POST /api/webhook/profiles
 * Receives profile data from n8n workflow.
 * Creates or updates a user profile based on username.
 * 
 * Body: {
 *   username: string (Telegram username without @),
 *   firstName?: string,
 *   lastName?: string,
 *   bio: string,
 *   photoUrl?: string
 * }
 * 
 * Headers: x-api-key: <WEBHOOK_API_KEY>
 */
router.post('/profiles', webhookAuthMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { username, firstName, lastName, bio, photoUrl, telegramId } = req.body;
    
    if (!bio) {
      return res.status(400).json({ error: 'Bio is required' });
    }
    
    if (!username && !telegramId) {
      return res.status(400).json({ error: 'Either username or telegramId is required' });
    }
    
    let user = null;
    
    // Try to find by telegramId first, then by username
    if (telegramId) {
      user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) }
      });
    }
    
    if (!user && username) {
      user = await prisma.user.findFirst({
        where: { username: username.replace('@', '') }
      });
    }
    
    if (user) {
      // Update existing user's profile
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          bio,
          photoUrl: photoUrl || user.photoUrl,
          firstName: firstName || user.firstName,
          lastName: lastName || user.lastName,
          username: username ? username.replace('@', '') : user.username
        }
      });
      
      res.json({ status: 'updated', userId: user.id });
    } else {
      // Create a placeholder user (will be linked when they auth via Telegram)
      // Use a temporary negative telegramId that will be replaced on first auth
      const tempId = BigInt(-Date.now());
      
      user = await prisma.user.create({
        data: {
          telegramId: tempId,
          username: username ? username.replace('@', '') : null,
          firstName: firstName || null,
          lastName: lastName || null,
          bio,
          photoUrl: photoUrl || null
        }
      });
      
      res.json({ status: 'created', userId: user.id });
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Failed to process profile' });
  }
});

/**
 * POST /api/webhook/profiles/batch
 * Receives multiple profiles at once
 */
router.post('/profiles/batch', webhookAuthMiddleware, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { profiles } = req.body;
    
    if (!Array.isArray(profiles)) {
      return res.status(400).json({ error: 'profiles must be an array' });
    }
    
    const results = [];
    
    for (const profile of profiles) {
      try {
        const { username, firstName, lastName, bio, photoUrl, telegramId } = profile;
        
        if (!bio) {
          results.push({ username, status: 'skipped', reason: 'no bio' });
          continue;
        }
        
        let user = null;
        
        if (telegramId) {
          user = await prisma.user.findUnique({
            where: { telegramId: BigInt(telegramId) }
          });
        }
        
        if (!user && username) {
          user = await prisma.user.findFirst({
            where: { username: username.replace('@', '') }
          });
        }
        
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              bio,
              photoUrl: photoUrl || user.photoUrl,
              firstName: firstName || user.firstName,
              lastName: lastName || user.lastName
            }
          });
          results.push({ username, status: 'updated' });
        } else {
          const tempId = BigInt(-Date.now() - Math.floor(Math.random() * 1000));
          await prisma.user.create({
            data: {
              telegramId: tempId,
              username: username ? username.replace('@', '') : null,
              firstName: firstName || null,
              lastName: lastName || null,
              bio,
              photoUrl: photoUrl || null
            }
          });
          results.push({ username, status: 'created' });
        }
      } catch (profileErr) {
        results.push({ username: profile.username, status: 'error', error: profileErr.message });
      }
    }
    
    res.json({ results });
  } catch (err) {
    console.error('Batch webhook error:', err);
    res.status(500).json({ error: 'Failed to process batch' });
  }
});

module.exports = router;
