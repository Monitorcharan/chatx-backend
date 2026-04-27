const Status = require('../models/Status');
const cloudinary = require('cloudinary').v2;

/**
 * Extracts Cloudinary public_id from a secure_url.
 * Example: https://res.cloudinary.com/cloud/image/upload/v123/chatx/images/abc.jpg
 * -> chatx/images/abc
 */
function getPublicIdFromUrl(url) {
  try {
    const parts = url.split('/');
    const folderIndex = parts.findIndex(p => p === 'chatx');
    if (folderIndex === -1) return null;
    
    // Join from 'chatx' onwards and remove extension
    const publicIdWithExt = parts.slice(folderIndex).join('/');
    return publicIdWithExt.split('.')[0];
  } catch (err) {
    return null;
  }
}

/**
 * Periodically cleans up expired statuses and their Cloudinary media.
 */
async function cleanupExpiredStatuses() {
  try {
    const now = new Date();
    // Find statuses that have expired but haven't been deleted by TTL yet
    const expiredStatuses = await Status.find({ expiresAt: { $lt: now } });

    if (expiredStatuses.length === 0) return;

    console.log(`🧹 [Cleanup] Found ${expiredStatuses.length} expired statuses to purge.`);

    for (const status of expiredStatuses) {
      const publicId = getPublicIdFromUrl(status.mediaUrl);
      
      if (publicId) {
        console.log(`🗑️ [Cleanup] Deleting media from Cloudinary: ${publicId}`);
        await cloudinary.uploader.destroy(publicId, {
          resource_type: status.mediaType === 'video' ? 'video' : 'image'
        });
      }

      // Manually delete document
      await Status.findByIdAndDelete(status._id);
    }

    console.log('✅ [Cleanup] Media purge complete.');
  } catch (error) {
    console.error('❌ [Cleanup] Error during status media cleanup:', error);
  }
}

module.exports = { cleanupExpiredStatuses };
