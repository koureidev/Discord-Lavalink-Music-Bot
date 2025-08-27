const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { EMBED_COLOR } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows the list of all available commands."),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const pages = [];
    let currentPage = 0;

    pages.push(
      new EmbedBuilder()
        .setColor(EMBED_COLOR || "#FFB6C1")
        .setTitle("👋 Hey! Need help?")
        .setDescription(
          "I'm your personal music bot, ready to play whatever you want.\n\nUse the ◀️ and ▶️ buttons to navigate the commands."
        )
        .setThumbnail(client.user.displayAvatarURL())
    );

    pages.push(
      new EmbedBuilder()
        .setColor(EMBED_COLOR || "#FFB6C1")
        .setTitle("🎵 Music Commands")
        .addFields(
          {
            name: "`/play <song>`",
            value: "Plays or adds a song/playlist from YouTube.",
          },
          { name: "`/pause`", value: "Pauses the current track." },
          { name: "`/resume`", value: "Resumes the paused track." },
          { name: "`/skip [amount]`", value: "Skips the current song(s)." },
          {
            name: "`/stop`",
            value: "Stops playback, clears the Queue, and disconnects the bot.",
          },
          {
            name: "`/search-youtube <query>`",
            value:
              "Searches up to 5 songs on YouTube and lets you choose which one to play.",
          },
          {
            name: "`/search-spotify <query>`",
            value:
              "Searches up to 5 songs on Spotify and lets you choose which one to play.",
          },
          {
            name: "`/forward <seconds>`",
            value: "Fast-forwards the current track.",
          },
          { name: "`/rewind <seconds>`", value: "Rewinds the current track." }
        )
    );

    pages.push(
      new EmbedBuilder()
        .setColor(EMBED_COLOR || "#FFB6C1")
        .setTitle("📜 Queue Commands")
        .addFields(
          { name: "`/queue view`", value: "Shows the current song Queue." },
          {
            name: "`/queue add <song> [position]`",
            value: "Adds a song at a specific position in the Queue.",
          },
          { name: "`/queue shuffle`", value: "Shuffles the Queue." },
          {
            name: "`/queue remove <position>`",
            value: "Removes a song by its position.",
          },
          {
            name: "`/queue move <from> <to>`",
            value: "Moves a song from one position to another.",
          },
          {
            name: "`/queue loop`",
            value: "Toggles repeating the entire Queue.",
          },
          {
            name: "`/lock`",
            value: "Locks the current track to repeat indefinitely.",
          },
          { name: "`/unlock`", value: "Unlocks repeat for the current track." }
        )
    );

    pages.push(
      new EmbedBuilder()
        .setColor(EMBED_COLOR || "#FFB6C1")
        .setTitle("📁 File Commands")
        .addFields(
          {
            name: "`/playfile <file>`",
            value: "Plays an audio file you attach to the command.",
          },
          {
            name: "`Right-click > Apps > Play this file`",
            value: "Plays an audio file from an existing message.",
          }
        )
    );

    pages.push(
      new EmbedBuilder()
        .setColor(EMBED_COLOR || "#FFB6C1")
        .setTitle("🛠️ Utility Commands")
        .addFields(
          {
            name: "`/ping`",
            value: "Checks the bot's latency and music server status.",
          },
          {
            name: "`/help`",
            value: "Shows this list of all available commands.",
          }
        )
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("help_prev")
        .setEmoji("◀️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("help_next")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("help_close")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Secondary)
    );

    const helpMessage = await interaction.editReply({
      embeds: [
        pages[currentPage].setFooter({
          text: `Page ${currentPage + 1}/${pages.length}`,
        }),
      ],
      components: [row],
    });

    const collector = helpMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 120_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "help_close") {
        return collector.stop("closed");
      }
      await i.deferUpdate();

      if (i.customId === "help_prev")
        currentPage = (currentPage - 1 + pages.length) % pages.length;
      else if (i.customId === "help_next")
        currentPage = (currentPage + 1) % pages.length;

      await interaction.editReply({
        embeds: [
          pages[currentPage].setFooter({
            text: `Page ${currentPage + 1}/${pages.length}`,
          }),
        ],
      });
    });

    collector.on("end", (_, reason) => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
