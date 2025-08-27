const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { EMBED_COLOR } = process.env;

function cleanupTempAudioCache() {
  const tempDir = path.join(__dirname, "..", "temp_audio_cache");
  if (!fs.existsSync(tempDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(tempDir);
    if (files.length === 0) {
      console.log("[CLEANUP] Audio cache folder was already empty.");
      return;
    }

    let deletedCount = 0;
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(tempDir, file));
        deletedCount++;
      } catch (err) {
        console.warn(`[CLEANUP] Failed to delete file ${file}:`, err.message);
      }
    }
    console.log(
      `[CLEANUP] Completed cleaning audio cache folder. ${deletedCount} file(s) deleted.`
    );
  } catch (err) {
    console.error("[CLEANUP] Error reading audio cache folder:", err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription(
      "Stops playback, clears the queue, and disconnects the bot."
    ),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player || !player.connected) {
      return interaction.reply({
        content: "❌ I am not connected to a voice channel.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId) {
      return interaction.reply({
        content: "❌ You need to be in the same voice channel as me.",
        flags: MessageFlags.Ephemeral,
      });
    }

    cleanupTempAudioCache();

    await player.destroy();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR || "#FFB6C1")
          .setDescription(
            "⏹️ Playback stopped, queue cleared, and bot disconnected."
          ),
      ],
    });
  },
};
