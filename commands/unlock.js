const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { EMBED_COLOR } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Disable repeat mode (track or queue)."),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player || !player.queue.current) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setColor("#FF0000")
            .setDescription("❌ There is no track to unlock!"),
        ],
      });
    }

    if (player.repeatMode !== "track" && player.repeatMode !== "queue") {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setColor("#FFCC00")
            .setDescription("⚠️ No repeat mode is currently active."),
        ],
      });
    }

    const previousMode = player.repeatMode;

    player.setRepeatMode("off");

    let description;
    if (previousMode === "track") {
      description =
        "Repeat for the **current track** has been disabled. The queue will continue normally.";
    } else if (previousMode === "queue") {
      description =
        "Repeat for the **entire queue** has been disabled. Playback will continue until the end of the queue.";
    }

    const unlockEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR || "#FFB6C1")
      .setTitle("🔓 Repeat Disabled!")
      .setDescription(description);

    await interaction.reply({ embeds: [unlockEmbed] });
  },
};
