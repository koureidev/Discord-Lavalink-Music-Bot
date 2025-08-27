const fs = require("fs");

function cleanupTrackFiles(tracks) {
  if (!Array.isArray(tracks)) tracks = [tracks];
  for (const t of tracks) {
    try {
      const localPath = t?.userData?.localFilePath;
      if (localPath && fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`[CLEANUP] Temporary file removed: ${localPath}`);
      }
    } catch (err) {
      console.warn(
        "[CLEANUP] Failed to remove local file:",
        err.message || err
      );
    }
  }
}

module.exports = { cleanupTrackFiles };
