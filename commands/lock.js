const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const path = require("path");
const { EMBED_COLOR } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Locks the current song to repeat infinitely."),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player || !player.queue.current) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#FF0000")
            .setDescription("❌ There is no song to lock!"),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (player.repeatMode === "track") {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#FFCC00")
            .setDescription("⚠️ The current song is already locked on repeat!"),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    player.setRepeatMode("track");

    const currentSong = player.queue.current;

    let rawTitle = currentSong.info?.title;
    if (!rawTitle || rawTitle.toLowerCase() === "unknown title") {
      if (currentSong.userData?.rawFileName) {
        rawTitle = path.parse(currentSong.userData.rawFileName).name;
      } else {
        rawTitle = "Untitled";
      }
    }

    const lockEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR || "#FFB6C1")
      .setTitle("🔒 Song Locked!")
      .setDescription(
        `The song **${rawTitle}** will now repeat until you use \`/unlock\`.`
      );

    await interaction.reply({ embeds: [lockEmbed] });
  },
};
