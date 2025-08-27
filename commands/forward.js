const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { EMBED_COLOR } = process.env;

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

function getEstimatedPosition(player) {
  const cur = player.queue?.current;
  if (!cur) return player.position || 0;

  const trackId = cur.info.identifier;
  if (player._lastSeek && player._lastSeek.trackId === trackId) {
    const elapsed = Date.now() - player._lastSeek.ts;
    return Math.min(player._lastSeek.pos + elapsed, cur.info.duration);
  }
  return player.position || 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forward")
    .setDescription("Forwards the current song by a specified amount of time.")
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription("How many seconds to forward.")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player || !player.connected)
      return interaction.reply({
        content: "❌ I am not connected to a voice channel.",
        flags: MessageFlags.Ephemeral,
      });

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId)
      return interaction.reply({
        content: "❌ You need to be in the same voice channel as me.",
        flags: MessageFlags.Ephemeral,
      });

    if (!player.queue.current || !player.queue.current.info.isSeekable)
      return interaction.reply({
        content: "❌ The current song cannot be seeked forward.",
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply();

    const secondsToForward = interaction.options.getInteger("seconds");
    const currentTrack = player.queue.current;
    const trackDuration = currentTrack.info.duration;

    const currentPosition = getEstimatedPosition(player);
    const newPosition = currentPosition + secondsToForward * 1000;

    if (newPosition >= trackDuration) {
      await player.skip();
      player._lastSeek = null;
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR || "#FFB6C1")
            .setDescription(
              "⏩ The song was forwarded to the end and skipped to the next."
            ),
        ],
      });
    }

    await player.seek(newPosition);
    player._lastSeek = {
      pos: newPosition,
      ts: Date.now(),
      trackId: currentTrack.info.identifier,
    };

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR || "#FFB6C1")
          .setDescription(
            `⏩ Forwarded to \`${formatDuration(
              newPosition
            )}\` (track total: \`${formatDuration(trackDuration)}\`).`
          ),
      ],
    });
  },
};
