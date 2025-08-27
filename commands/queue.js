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
const { fetchYouTubePlaylist } = require("../utils/playlist");
const path = require("path");

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) ms = 0;
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor((ms / 60000) % 60);
  const h = Math.floor(ms / 3600000);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function safeNum(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : NaN;
}
function getTrackTitle(track) {
  if (!track) return "Unknown";

  let title = track.info?.title;

  if (!title || title.toLowerCase() === "unknown title") {
    if (track.userData?.rawFileName) {
      title = path.parse(track.userData.rawFileName).name;
    } else {
      title = "Unknown";
    }
  }

  return title;
}
function getTrackUri(track) {
  return track?.userData?.displayUri ?? track?.info?.uri ?? track?.uri ?? "#";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Manage the song Queue.")

    .addSubcommand((sub) =>
      sub.setName("view").setDescription("Shows the current song Queue.")
    )

    .addSubcommand((sub) =>
      sub.setName("shuffle").setDescription("Shuffles the songs in the Queue.")
    )

    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Removes a song from the Queue.")
        .addIntegerOption((o) =>
          o
            .setName("position")
            .setDescription(
              "The position of the song to remove (starting from 2)."
            )
            .setRequired(true)
            .setMinValue(2)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("move")
        .setDescription("Moves a song to a different position in the Queue.")
        .addIntegerOption((o) =>
          o
            .setName("from")
            .setDescription("The current position (starting from 2).")
            .setRequired(true)
            .setMinValue(2)
        )
        .addIntegerOption((o) =>
          o
            .setName("to")
            .setDescription("The new position (starting from 2).")
            .setRequired(true)
            .setMinValue(2)
        )
    )

    .addSubcommand((sub) =>
      sub.setName("loop").setDescription("Toggles the Queue repeat mode.")
    )

    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription(
          "Adds a song to the Queue, optionally at a specific position."
        )
        .addStringOption((o) =>
          o
            .setName("song")
            .setDescription("The name or link of the song.")
            .setRequired(true)
        )
        .addIntegerOption((o) =>
          o
            .setName("position")
            .setDescription(
              "The position where the song will be inserted (starting from 2)."
            )
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    let player = client.lavalink.getPlayer(interaction.guildId);

    const getUpcomingCount = (player) => {
      if (!player || !player.queue) return 0;
      const size = safeNum(player.queue.size);
      if (Number.isFinite(size)) return size;
      const arr = Array.isArray(player.queue.tracks) ? player.queue.tracks : [];
      return arr.length;
    };

    try {
      switch (sub) {
        case "view": {
          if (
            !player ||
            !player.connected ||
            !player.queue ||
            !player.queue.current
          ) {
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription("❌ Not playing anything at the moment."),
              ],
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const current = player.queue.current;
          const queueArr = Array.isArray(player.queue.tracks)
            ? player.queue.tracks
            : [];
          const totalTracks =
            typeof player.queue.totalSize === "number"
              ? player.queue.totalSize
              : (current ? 1 : 0) + queueArr.length;
          const totalDuration =
            typeof player.queue.duration === "number"
              ? player.queue.duration
              : (current?.info?.duration ?? 0) +
                queueArr.reduce(
                  (s, t) => s + (t?.info?.duration ?? t?.duration ?? 0),
                  0
                );

          const upcomingLines = queueArr.map((t, i) => {
            const idx = i + 2;
            const title = getTrackTitle(t);
            const uri = getTrackUri(t);
            const dur = formatDuration(t?.info?.duration ?? t?.duration ?? 0);
            return `**${idx}.** [${title}](${uri}) • \`[${dur}]\``;
          });

          const FIELD_CHAR_LIMIT = 1024;
          const pages = [];
          let cur = "";
          for (let i = 0; i < upcomingLines.length; i++) {
            const line = upcomingLines[i];
            if (line.length > FIELD_CHAR_LIMIT) {
              let safeLine = line;
              if (safeLine.length > FIELD_CHAR_LIMIT) {
                safeLine = safeLine.slice(0, FIELD_CHAR_LIMIT - 3) + "...";
              }
              if (cur) {
                pages.push(cur);
                cur = "";
              }
              pages.push(safeLine);
              continue;
            }

            if (!cur) {
              cur = line;
            } else {
              if (cur.length + 1 + line.length > FIELD_CHAR_LIMIT) {
                pages.push(cur);
                cur = line;
              } else {
                cur = cur + "\n" + line;
              }
            }
          }
          if (cur) pages.push(cur);

          if (pages.length === 0) pages.push("— No upcoming songs —");

          let pageIndex = 0;
          const makeEmbedForPage = (pageIdx) => {
            const e = new EmbedBuilder()
              .setColor(EMBED_COLOR || "#FFB6C1")
              .setTitle("📜 Queue")
              .setThumbnail(current?.info?.artworkUrl)
              .setDescription(
                `**Playing now:**\n**1.** [${getTrackTitle(
                  current
                )}](${getTrackUri(current)}) • \`[${formatDuration(
                  current?.info?.duration ?? current?.duration ?? 0
                )}]\``
              )
              .setFooter({
                text: `Total songs: ${
                  Number.isFinite(totalTracks) ? totalTracks : 0
                } | Total duration: ${formatDuration(
                  Number.isFinite(totalDuration) ? totalDuration : 0
                )} — Page ${pageIdx + 1}/${pages.length}`,
              });

            e.addFields({ name: "Upcoming Songs", value: pages[pageIdx] });
            return e;
          };

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("queue_prev")
              .setEmoji("◀️")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pages.length === 1),
            new ButtonBuilder()
              .setCustomId("queue_next")
              .setEmoji("▶️")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pages.length === 1)
          );

          const reply = await interaction.editReply({
            embeds: [makeEmbedForPage(pageIndex)],
            components: [row],
          });

          const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 120_000,
          });

          collector.on("collect", async (i) => {
            await i.deferUpdate();
            if (i.customId === "queue_prev") {
              pageIndex = (pageIndex - 1 + pages.length) % pages.length;
            } else if (i.customId === "queue_next") {
              pageIndex = (pageIndex + 1) % pages.length;
            }
            const newRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("queue_prev")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pages.length === 1),

              new ButtonBuilder()
                .setCustomId("queue_next")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pages.length === 1)
            );

            await interaction.editReply({
              embeds: [makeEmbedForPage(pageIndex)],
              components: [newRow],
            });
          });

          collector.on("end", () => {
            interaction.editReply({ components: [] }).catch(() => {});
          });
          return;
        }

        case "add": {
          const query = interaction.options.getString("song");
          const posInput = interaction.options.getInteger("position");
          const voiceChannel = interaction.member?.voice?.channel;
          if (!voiceChannel) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription("❌ You need to be in a voice channel!"),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          if (!player) {
            player = client.lavalink.createPlayer({
              guildId: interaction.guild.id,
              voiceChannelId: voiceChannel.id,
              textChannelId: interaction.channel.id,
              selfDeaf: true,
            });
            if (player.state !== "CONNECTED") await player.connect();
          }

          const upcoming = getUpcomingCount(player);
          const wasCompletelyEmpty = upcoming === 0 && !player.queue.current;
          const willStartPlaying =
            wasCompletelyEmpty && !player.playing && !player.paused;

          await interaction.deferReply();

          let tracks = [];
          let isPlaylistHandled = false;
          let playlistName = null;

          if (query && query.includes("list=")) {
            try {
              const playlistItems = await fetchYouTubePlaylist(query);
              if (playlistItems && playlistItems.length > 0) {
                isPlaylistHandled = true;

                for (const item of playlistItems) {
                  try {
                    const res = await player.search(
                      { query: item.url },
                      interaction.user
                    );
                    if (res && res.tracks && res.tracks.length) {
                      tracks.push(res.tracks[0]);
                    }
                  } catch (err) {
                    console.warn(
                      "Failed to fetch playlist item:",
                      item.url,
                      err?.message || err
                    );
                  }
                }
              }
            } catch (err) {
              console.error(
                "Error fetching playlist via utils:",
                err?.message || err
              );
              isPlaylistHandled = false;
            }
          }

          let search;
          if (!isPlaylistHandled) {
            try {
              search = await player.search({ query }, interaction.user);
            } catch (e) {
              console.error("Error fetching song (add):", e?.message || e);
              return interaction
                .editReply({
                  embeds: [
                    new EmbedBuilder()
                      .setColor("#FF0000")
                      .setDescription(
                        "❌ Failed to fetch the song. Please try again."
                      ),
                  ],
                })
                .catch(() => {});
            }

            if (!search || !search.tracks.length) {
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

            tracks =
              search.loadType === "playlist"
                ? search.tracks
                : [search.tracks[0]];
            if (search.loadType === "playlist") {
              playlistName = search.playlist?.name || null;
            }
          }

          if (!tracks || !tracks.length) {
            return interaction
              .editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#FF0000")
                    .setDescription("❌ Couldn't load the playlist songs."),
                ],
              })
              .catch(() => {});
          }

          let insertIndex;
          if (posInput !== null) {
            if (wasCompletelyEmpty) {
              insertIndex = 0;
            } else if (posInput < 2) {
              return interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#FF0000")
                    .setDescription(
                      "❌ Position 1 is the currently playing song. Please choose a position of 2 or higher."
                    ),
                ],
              });
            } else {
              const maxAllowed = upcoming + 1;
              if (posInput > maxAllowed) {
                insertIndex = upcoming;
              } else {
                insertIndex = posInput - 2;
                if (insertIndex < 0) insertIndex = 0;
                if (insertIndex > upcoming) insertIndex = upcoming;
              }
            }
          }

          if (typeof insertIndex === "number") {
            if (tracks.length > 1) {
              for (let i = 0; i < tracks.length; i++) {
                try {
                  player.queue.add(tracks[i], insertIndex + i);
                } catch (e) {}
              }
            } else {
              player.queue.add(tracks[0], insertIndex);
            }
          } else {
            if (tracks.length > 1) player.queue.add(tracks);
            else player.queue.add(tracks[0]);
          }

          if (willStartPlaying) {
            try {
              const channel =
                interaction.channel ||
                client.channels.cache.get(player.textChannelId);

              if (isPlaylistHandled || search?.loadType === "playlist") {
                const playlistEmbed = new EmbedBuilder()
                  .setColor(process.env.EMBED_COLOR || "#FFB6C1")
                  .setTitle("✅ Playlist Added")
                  .setDescription(
                    `Added playlist with **${tracks.length}** songs.`
                  )
                  .setFooter({ text: `Requested by ${interaction.user.tag}` })
                  .setTimestamp();

                await interaction
                  .editReply({
                    embeds: [playlistEmbed],
                  })
                  .catch(() => {});

                let loadingMsg = null;
                try {
                  if (channel) {
                    loadingMsg = await channel
                      .send("⏳ Loading playlist...")
                      .catch(() => null);
                  }
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
                  .editReply({
                    content: "⏳ Loading your song...",
                    fetchReply: true,
                  })
                  .catch(() => null);

                if (replyMsg) {
                  try {
                    player.set("loadingMessage", replyMsg);
                  } catch (e) {}
                }
              }

              await player.play();
              return;
            } catch (e) {
              console.error("Error starting playback (add):", e?.message || e);
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

          let posSuffix = "";
          if (typeof insertIndex === "number") {
            if (wasCompletelyEmpty && insertIndex === 0) {
              posSuffix = " (playing now)";
            } else {
              const base = wasCompletelyEmpty ? 1 : 2;
              const shownPos = insertIndex + base;
              posSuffix = ` (at position: ${shownPos})`;
            }
          }

          let desc;
          if (isPlaylistHandled) {
            desc = `✅ Added **${tracks.length}** songs from playlist **${
              playlistName || "Unknown"
            }**${posSuffix}`;
          } else if (search && search.loadType === "playlist") {
            desc = `✅ Added **${tracks.length}** songs from playlist **${
              playlistName || search.playlist?.name || "Unknown"
            }**${posSuffix}`;
          } else if (tracks.length > 1) {
            desc = `✅ Added **${tracks.length}** songs to queue.${posSuffix}`;
          } else {
            desc = `📁 [${tracks[0].info.title}](${tracks[0].info.uri})${posSuffix}`;
          }

          const embedOK = new EmbedBuilder()
            .setColor(process.env.EMBED_COLOR || "#FFB6C1")
            .setTitle("✅ Added to Queue")
            .setDescription(desc)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

          return interaction.editReply({ embeds: [embedOK] });
        }

        case "shuffle": {
          if (!player || !player.connected || !player.queue) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription("❌ Not playing anything at the moment."),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          const upcoming = getUpcomingCount(player);
          const hasCurrent = !!player.queue.current;
          if (upcoming < 2) {
            return interaction.reply({
              ephemeral: true,
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription(
                    "❌ You need at least 2 songs in the Queue to shuffle."
                  ),
              ],
            });
          }

          await interaction.deferReply();

          try {
            if (typeof player.queue.shuffle === "function") {
              player.queue.shuffle();
            } else if (Array.isArray(player.queue.tracks)) {
              const arr = player.queue.tracks;
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
            } else {
              throw new Error("Shuffle not supported in this Queue.");
            }
          } catch (e) {
            console.warn("Failed to shuffle:", e);
            return interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription("❌ Could not shuffle the Queue right now."),
              ],
            });
          }

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(EMBED_COLOR || "#2f3136")
                .setDescription("🔀 The Queue has been shuffled!"),
            ],
          });
        }

        case "remove": {
          const pos = interaction.options.getInteger("position");
          const upcoming = getUpcomingCount(player);
          const maxPos = (player.queue.current ? 1 : 0) + upcoming;

          if (maxPos < 2) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription(
                    "❌ There are no songs in the Queue to remove."
                  ),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          if (pos < 2 || pos > maxPos) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription(
                    `❌ Invalid position. Please enter a number between 2 and ${maxPos}.`
                  ),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.deferReply();
          const removed = Array.isArray(player.queue.tracks)
            ? player.queue.tracks.splice(pos - 2, 1)[0]
            : player.queue.remove
            ? player.queue.remove(pos - 2, 1)[0]
            : null;

          const title = removed ? getTrackTitle(removed) : "Unknown";
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(EMBED_COLOR || "#2f3136")
                .setDescription(`🗑️ Removed: **${title}**`),
            ],
          });
        }

        case "move": {
          if (!player || !player.connected || !player.queue) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription("❌ Not playing anything at the moment."),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          const fromPos = interaction.options.getInteger("from");
          const toPos = interaction.options.getInteger("to");

          const upcoming = getUpcomingCount(player);
          const maxPos = (player.queue.current ? 1 : 0) + upcoming;

          if (fromPos === toPos) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription("❌ Positions cannot be the same."),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          if (fromPos < 2 || toPos < 2 || fromPos > maxPos || toPos > maxPos) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#FF0000")
                  .setDescription(
                    `❌ Invalid position. Please enter a number between 2 and ${maxPos}.`
                  ),
              ],
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.deferReply();

          const fromIndex = fromPos - 2;
          const toIndex = toPos - 2;
          let moved;

          try {
            if (Array.isArray(player.queue.tracks)) {
              moved = player.queue.tracks.splice(fromIndex, 1)[0];
              if (moved) player.queue.tracks.splice(toIndex, 0, moved);
            } else if (
              typeof player.queue.remove === "function" &&
              typeof player.queue.add === "function"
            ) {
              moved = player.queue.remove(fromIndex, 1)[0];
              if (moved) player.queue.add(moved, toIndex);
            } else {
              throw new Error("Move method not supported.");
            }
          } catch (e) {
            console.warn("Failed to move song:", e);
          }

          const title = moved ? getTrackTitle(moved) : "Unknown";
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(EMBED_COLOR || "#2f3136")
                .setDescription(
                  `✅ Moved **${title}** from position \`${fromPos}\` to \`${toPos}\`.`
                ),
            ],
          });
        }

        case "loop": {
          await interaction.deferReply();
          const newMode = player.repeatMode === "queue" ? "off" : "queue";
          player.setRepeatMode(newMode);
          const modeText = newMode === "queue" ? "Enabled" : "Disabled";

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(EMBED_COLOR || "#2f3136")
                .setDescription(`🔁 Queue loop is now: **${modeText}**.`),
            ],
          });
        }

        default:
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription("❌ Invalid subcommand."),
            ],
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (err) {
      console.error("Error in /queue:", err);

      const errEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription(
          "❌ An error occurred while executing the `/queue` command. Check the console for details."
        );

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errEmbed] });
      } else {
        await interaction.reply({
          embeds: [errEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
