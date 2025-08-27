const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { EMBED_COLOR } = process.env;
const path = require("path");
const fs = require("fs");

function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor((ms / 1000) % 60),
    m = Math.floor((ms / 60000) % 60),
    h = Math.floor(ms / 3600000);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resumes the paused song."),

  async execute(interaction, client) {
    const vcId = interaction.member?.voice?.channelId;
    if (!vcId)
      return interaction.reply({
        content: "❌ You need to be in a voice channel!",
        flags: MessageFlags.Ephemeral,
      });

    const player = client.lavalink.getPlayer(interaction.guildId);
    if (!player)
      return interaction.reply({
        content: "❌ Not playing anything at the moment.",
        flags: MessageFlags.Ephemeral,
      });
    if (player.voiceChannelId !== vcId)
      return interaction.reply({
        content: "❌ You need to be in the same channel as me.",
        flags: MessageFlags.Ephemeral,
      });

    if (!player.paused)
      return interaction.reply({
        content: "▶️ The song is already playing.",
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply();

    try {
      const current = player.queue.current;
      if (!current) {
        await player.resume();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLOR || "#2f3136")
              .setDescription("▶️ Song resumed!"),
          ],
        });
      }

      const lastPos = player.lastPosition ?? 0;
      const duration = current.info?.duration ?? 0;
      const safePosition = Math.max(
        0,
        Math.min(lastPos, Math.max(0, duration - 1000))
      );

      const pausedAt = player.get?.("custom_pause_timestamp") ?? null;
      const pauseDurationSec = pausedAt ? (Date.now() - pausedAt) / 1000 : null;
      if (pauseDurationSec !== null && pauseDurationSec < 30) {
        await player.resume();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLOR || "#2f3136")
              .setDescription("▶️ Song resumed!"),
          ],
        });
      }

      const localFileName = current.userData?.localFileName;
      const localFilePath = current.userData?.localFilePath;

      if (localFileName && localFilePath && global.localAudioServerUrl) {
        try {
          const baseUrl = global.localAudioServerUrl.endsWith("/")
            ? global.localAudioServerUrl
            : `${global.localAudioServerUrl}/`;

          const fileUrl = `${baseUrl}${encodeURIComponent(localFileName)}`;
          console.log(
            `[resume] Trying to reload local file for resume: ${fileUrl}`
          );

          const localSearch = await player.search(
            { query: fileUrl },
            interaction.user
          );

          if (
            localSearch &&
            Array.isArray(localSearch.tracks) &&
            localSearch.tracks.length > 0
          ) {
            const localTrack = localSearch.tracks[0];

            localTrack.userData = {
              ...(current.userData || {}),
              localFileName,
              localFilePath,
              resumeSkipFix: "true",
            };

            await player.play({
              track: {
                encoded: localTrack.encoded,
                requester: current.requester,
                userData: localTrack.userData,
              },
              paused: false,
              position: safePosition,
              noReplace: false,
            });

            console.log(
              `[resume] Resume via local track successful — pos: ${safePosition}`
            );
            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(EMBED_COLOR || "#2f3136")
                  .setDescription("▶️ Song resumed (local file)!"),
              ],
            });
          } else {
            console.warn(
              "[resume] localSearch did not return tracks, falling back."
            );
          }
        } catch (localErr) {
          console.warn(
            "[resume] Failed to reload local version for resume:",
            localErr?.message || localErr
          );
        }
      }

      try {
        await player.play({
          track: {
            encoded: current.encoded,
            requester: current.requester,
            userData: Object.assign({}, current.userData || {}, {
              resumeSkipFix: "true",
            }),
          },
          paused: false,
          position: safePosition,
          noReplace: false,
        });
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLOR || "#2f3136")
              .setDescription("▶️ Song resumed!"),
          ],
        });
      } catch (err2) {
        console.error(
          "Error in resume fallback when calling player.play():",
          err2
        );
        try {
          await player.resume();
        } catch (e) {
          console.error("resume() also failed", e);
        }
        return interaction.editReply({
          content: "❌ Could not resume the song correctly.",
        });
      }
    } catch (err) {
      console.error("Error in /resume:", err);
      return interaction.editReply({
        content: "❌ Could not resume the song.",
      });
    }
  },
};
