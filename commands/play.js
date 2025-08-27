const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const path = require("path");
const { fetchYouTubePlaylist } = require("../utils/playlist");
const { EMBED_COLOR } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Plays a song or adds it to the queue.")
    .addStringOption((option) =>
      option
        .setName("music")
        .setDescription("The name or link of the song/playlist.")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const query = interaction.options.getString("music");
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription("❌ You need to be in a voice channel!"),
          ],
        })
        .catch(() => {});
    }

    let player = client.lavalink.getPlayer(interaction.guild.id);
    if (!player) {
      player = client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channel.id,
        selfDeaf: true,
      });
    }

    if (player.voiceChannelId && player.voiceChannelId !== voiceChannel.id) {
      return interaction
        .editReply({
          content: "❌ You must be in the same voice channel as me!",
        })
        .catch(() => {});
    }

    if (player.state !== "CONNECTED") await player.connect();

    const wasQueueEmpty = !player.queue.current;

    let tracksToAdd = [];
    let isPlaylistHandled = false;

    if (query.includes("list=")) {
      const playlistTracks = await fetchYouTubePlaylist(query);
      if (playlistTracks && playlistTracks.length > 0) {
        isPlaylistHandled = true;
        for (const t of playlistTracks) {
          const res = await player.search({ query: t.url }, interaction.user);
          if (res && res.tracks.length) {
            tracksToAdd.push(res.tracks[0]);
          }
        }
      }
    }

    let searchResult;
    if (!isPlaylistHandled) {
      try {
        searchResult = await player.search({ query }, interaction.user);
      } catch (e) {
        console.error("Error searching song (play):", e?.message || e);

        return interaction
          .editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription(
                  "❌ Error searching for the song. Please try again."
                ),
            ],
          })
          .catch(() => {});
      }

      if (!searchResult || !searchResult.tracks.length) {
        return interaction
          .editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription("❌ No results found."),
            ],
          })
          .catch(() => {});
      }

      tracksToAdd =
        searchResult.loadType === "playlist"
          ? searchResult.tracks
          : [searchResult.tracks[0]];
    }
    const willStartPlaying = wasQueueEmpty && !player.playing && !player.paused;

    if (tracksToAdd.length > 0) {
      tracksToAdd[0].userData = Object.assign(tracksToAdd[0].userData || {}, {
        interaction,
        isFile: false,
      });

      for (const t of tracksToAdd) {
        try {
          t.requester = t.requester || interaction.user.tag;
        } catch (e) {}
      }
    }

    player.queue.add(tracksToAdd);

    if (willStartPlaying) {
      try {
        const channel =
          interaction.channel ||
          client.channels.cache.get(player.textChannelId);

        if (isPlaylistHandled) {
          const playlistEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR || "#FFB6C1")
            .setTitle("✅ Playlist Added")
            .setDescription(
              `Added playlist with **${tracksToAdd.length}** songs.`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

          await interaction
            .editReply({ embeds: [playlistEmbed] })
            .catch(() => {});

          let loadingMsg = null;
          try {
            if (channel)
              loadingMsg = await channel
                .send("⏳ Loading playlist...")
                .catch(() => null);
          } catch (err) {
            loadingMsg = null;
          }

          if (loadingMsg) {
            try {
              player.set("loadingMessage", loadingMsg);
            } catch (e) {}
          }
        } else {
          const replyMsg = await interaction
            .editReply({ content: "⏳ Loading your file...", fetchReply: true })
            .catch(() => null);
          if (replyMsg) {
            try {
              player.set("loadingMessage", replyMsg);
            } catch (e) {}
          }
        }

        await player.play();
      } catch (e) {
        console.error("Error starting playback (play):", e?.message || e);
        return interaction
          .editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription("❌ Failed to start playback."),
            ],
          })
          .catch(() => {});
      }
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLOR || "#FFB6C1");

    if (isPlaylistHandled) {
      embed
        .setTitle("✅ Playlist Added")
        .setDescription(
          `Added the playlist **${
            searchResult.playlist?.name || "Unknown"
          }** with **${tracksToAdd.length}** songs.`
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();
    } else if (searchResult && searchResult.loadType === "playlist") {
      embed
        .setTitle("✅ Playlist Added")
        .setDescription(
          `Added the playlist **${
            searchResult.playlist?.name || "Unknown"
          }** with **${tracksToAdd.length}** songs.`
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();
    } else {
      const trackInfo = tracksToAdd[0].info;
      embed
        .setTitle("✅ Added to Queue")
        .setDescription(`[${trackInfo.title}](${trackInfo.uri})`)
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();
    }

    return interaction.editReply({ embeds: [embed] }).catch(() => {});
  },
};
