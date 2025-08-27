const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { EMBED_COLOR } = process.env;

const cleanupFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[CLEANUP] Deleted skipped file: ${path.basename(filePath)}`);
    }
  } catch (err) {
    console.warn(
      `[CLEANUP] Failed to delete file ${path.basename(filePath)}:`,
      err.message
    );
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip one or more songs in the queue.")
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription(
          "Number of songs to skip (default: 1, includes the current one)."
        )
        .setRequired(false)
        .setMinValue(1)
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

    if (!player.queue || !player.queue.current) {
      return interaction.reply({
        content: "❌ There is no song playing to skip.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const amountToSkip = interaction.options.getInteger("amount") ?? 1;

    const upcomingCount = Array.isArray(player.queue?.tracks)
      ? player.queue.tracks.length
      : Number.isFinite(player.queue?.size)
      ? player.queue.size
      : 0;

    const total = (player.queue?.current ? 1 : 0) + upcomingCount;

    if (amountToSkip >= total) {
      const allTracks = [
        player.queue.current,
        ...(player.queue?.tracks || []),
      ].filter(Boolean);
      for (const track of allTracks) {
        if (track?.userData?.localFilePath) {
          cleanupFile(track.userData.localFilePath);
        }
      }

      try {
        if (typeof player.queue?.clear === "function") {
          player.queue.clear();
        } else if (Array.isArray(player.queue?.tracks)) {
          player.queue.tracks.length = 0;
        }
      } catch {}

      try {
        if (typeof player.stop === "function") {
          await player.stop();
        } else {
          await player.destroy();
        }
      } catch {
        try {
          await player.destroy();
        } catch {}
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR || "#FFB6C1")
            .setDescription(
              "⏭️ Queue skipped completely. Nothing left to play."
            ),
        ],
      });
    }

    const tracksToSkip = [];
    if (player.queue.current) {
      tracksToSkip.push(player.queue.current);
    }
    const upcomingToSkipCount = amountToSkip - 1;
    if (upcomingToSkipCount > 0 && player.queue.tracks.length > 0) {
      tracksToSkip.push(...player.queue.tracks.slice(0, upcomingToSkipCount));
    }
    for (const track of tracksToSkip) {
      if (track?.userData?.localFilePath) {
        cleanupFile(track.userData.localFilePath);
      }
    }

    try {
      await player.skip(amountToSkip);
    } catch (err) {
      console.error("Skip error:", err);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR || "#FFB6C1")
            .setDescription("❌ Error trying to skip the song."),
        ],
      });
    }

    if (player.queue?.current) {
      if (!player.queue.current.userData) player.queue.current.userData = {};
      player.queue.current.userData.interaction = interaction;
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR || "#FFB6C1")
          .setDescription(`⏭️ **${amountToSkip}** song(s) have been skipped.`),
      ],
    });
  },
};
