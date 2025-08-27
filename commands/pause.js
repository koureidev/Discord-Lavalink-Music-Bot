const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { EMBED_COLOR } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pauses the current song."),

  async execute(interaction, client) {
    const vcId = interaction.member?.voice?.channelId;

    if (!vcId)
      return interaction.reply({
        content: "❌ You need to join a voice channel!",
        flags: MessageFlags.Ephemeral,
      });

    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player)
      return interaction.reply({
        content: "❌ I am not playing anything.",
        flags: MessageFlags.Ephemeral,
      });

    if (player.voiceChannelId !== vcId)
      return interaction.reply({
        content: "❌ You need to be in the same channel as me.",
        flags: MessageFlags.Ephemeral,
      });

    if (player.paused)
      return interaction.reply({
        content: "⏸️ The song is already paused.",
        flags: MessageFlags.Ephemeral,
      });

    try {
      await player.pause();
      if (player.set) player.set("custom_pause_timestamp", Date.now());

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR || "#FFB6C1")
        .setDescription("⏸️ Song paused!");

      return interaction.reply({
        embeds: [embed],
      });
    } catch (err) {
      console.error("Error on /pause:", err);
      return interaction.reply({
        content: "❌ Could not pause the song.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
