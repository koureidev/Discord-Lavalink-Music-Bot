const playdl = require("play-dl");

async function fetchYouTubePlaylist(url) {
  if (!url.includes("list=")) return null;

  try {
    const playlist = await playdl.playlist_info(url, { incomplete: true });
    const videos = await playlist.all_videos();

    return videos.map((v) => ({
      title: v.title,
      url: v.url,
    }));
  } catch (err) {
    console.error("Error fetching playlist:", err);
    return null;
  }
}

module.exports = { fetchYouTubePlaylist };
