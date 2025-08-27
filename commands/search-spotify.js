const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { EMBED_COLOR } = process.env;
const activeSearches = new Set();

function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor((ms / 1000) % 60),
    m = Math.floor((ms / 60000) % 60),
    h = Math.floor((ms / 3600000) % 24);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search-spotify")
    .setDescription("Search for songs on Spotify")
    .addStringOption((option) =>
      option.setName("query").setDescription("What do you want to search for?")
    ),

  async execute(interaction, client) {
    if (activeSearches.has(interaction.user.id)) {
      return interaction.reply({
        ephemeral: true,
        content: "❌ You already have an active search!",
      });
    }

    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel)
      return interaction.reply({
        ephemeral: true,
        content: "❌ You need to be in a voice channel!",
      });

    activeSearches.add(interaction.user.id);

    try {
      await interaction.deferReply();
      const player = client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channel.id,
        selfDeaf: true,
      });
      if (player.state !== "CONNECTED") await player.connect();

      const searchResult = await player.search(
        { query, source: "spsearch" },
        interaction.user
      );
      if (searchResult.loadType !== "search")
        return interaction.editReply({ content: "❌ No results found." });

      const tracks = searchResult.tracks.slice(0, 5);
      const embeds = tracks.map((track, i) =>
        new EmbedBuilder()
          .setColor(EMBED_COLOR || "#FFB6C1")
          .setDescription(
            `**${i + 1}.** [${track.info.title}](${track.info.uri}) | \`${
              track.info.author
            }\` | \`${formatDuration(track.info.duration)}\``
          )
          .setThumbnail(track.info.artworkUrl)
      );

      const row1 = new ActionRowBuilder().addComponents(
        ...tracks.map((_, i) =>
          new ButtonBuilder()
            .setCustomId(`search_select_${i}`)
            .setLabel(`${i + 1}`)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("search_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.editReply({
        content: `Results for **${query}**:`,
        embeds,
        components: [row1, row2],
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "search_cancel")
          return i.update({
            content: "❌ Search canceled.",
            embeds: [],
            components: [],
          });
        const chosenTrack = tracks[parseInt(i.customId.split("_")[2])];
        player.queue.add(chosenTrack);
        if (!player.playing) await player.play();
        await i.update({
          content: `✅ Added **${chosenTrack.info.title}**`,
          embeds: [],
          components: [],
        });
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time" && collected.size === 0)
          interaction
            .editReply({
              content: "⏰ Search expired.",
              embeds: [],
              components: [],
            })
            .catch(() => {});
      });
    } finally {
      activeSearches.delete(interaction.user.id);
    }
  },
};
