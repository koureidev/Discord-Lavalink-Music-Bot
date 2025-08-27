const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { LOCAL_AUDIO_SERVER_URL } = process.env;
const path = require("path");
const fs = require("fs");
const axios = require("axios");

async function downloadFile(
  url,
  destinationPath,
  minPercent = 0.2,
  progressTimeoutMs = 120000
) {
  const controller = new AbortController();
  let downloaded = 0;
  let progressTimer;

  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "stream",
      signal: controller.signal,
    });

    const totalSize = parseInt(response.headers["content-length"] || "0", 10);
    const targetBytes =
      totalSize > 0 ? Math.floor(totalSize * minPercent) : null;

    if (targetBytes) {
      progressTimer = setTimeout(() => {
        controller.abort();
      }, progressTimeoutMs);
    }

    const writer = fs.createWriteStream(destinationPath);

    response.data.on("data", (chunk) => {
      downloaded += chunk.length;
      if (targetBytes && downloaded >= targetBytes) {
        try {
          clearTimeout(progressTimer);
        } catch (e) {}
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", (err) => {
        try {
          if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
        } catch (e) {}
        reject(err);
      });
    });
  } finally {
    try {
      clearTimeout(progressTimer);
    } catch (e) {}
  }
}

async function downloadWithRetry(
  url,
  destinationPath,
  minPercent = 0.2,
  progressTimeoutMs = 120000,
  maxRetries = 1
) {
  let attempt = 0;
  while (true) {
    try {
      attempt++;
      await downloadFile(url, destinationPath, minPercent, progressTimeoutMs);
      return;
    } catch (err) {
      const isRetryable =
        err &&
        err.message &&
        (err.message.includes("ECONNRESET") ||
          err.message.includes("socket hang up") ||
          err.code === "ECONNRESET");
      if (!isRetryable || attempt > maxRetries) {
        throw err;
      }
      await new Promise((res) => setTimeout(res, 600));
    }
  }
}

async function addTrackToQueueAndPlay(player, track, interaction, attachment) {
  const isQueueEmpty = !player.queue.current;

  track.userData = Object.assign(track.userData || {}, {
    isFile: true,
    interaction: interaction,
    rawFileName: attachment.name,
    displayUri: attachment.url,
  });

  player.queue.add(track);

  if (isQueueEmpty) {
    if (!player.playing && !player.paused) {
      await player.play();
    }
    return true;
  } else {
    let safeTitle = track.info?.title;
    if (!safeTitle || safeTitle.toLowerCase() === "unknown title") {
      safeTitle = path.parse(attachment.name).name;
    }

    const embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR || "#FFB6C1")
      .setTitle("✅ Added to Queue")
      .setDescription(`📁 [${safeTitle}](${track.userData.displayUri})`)
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    try {
      await interaction
        .editReply({
          content: "",
          embeds: [embed],
        })
        .catch(() => {});
    } catch (e) {}

    try {
      player.set("loadingMessage", null);
    } catch (e) {}

    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playfile")
    .setDescription("Plays an audio file you upload.")
    .addAttachmentOption((option) =>
      option
        .setName("file")
        .setDescription(
          "The audio file you want to play (mp3, opus, ogg, wav, flac)."
        )
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        content: "❌ You need to be in a voice channel!",
      });
    }

    const attachment = interaction.options.getAttachment("file");

    const allowedExtensions = [".mp3", ".opus", ".ogg", ".wav", ".flac"];
    if (
      !allowedExtensions.some((ext) =>
        attachment.name.toLowerCase().endsWith(ext)
      )
    ) {
      return interaction.editReply({
        content: `❌ Invalid file format! Use: ${allowedExtensions.join(", ")}`,
      });
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
      return interaction.editReply({
        content: "❌ You must be in the same voice channel as me!",
      });
    }

    if (player.state !== "CONNECTED") await player.connect();

    let hasSentError = false;
    const sendError = async (text) => {
      if (hasSentError) return;
      hasSentError = true;
      await interaction
        .editReply({
          content: text,
        })
        .catch(() => {});
    };

    const ensureFileCleanupListener = () => {
      if (client._fileCleanupListenerAdded) return;
      client._fileCleanupListenerAdded = true;

      client.lavalink.on("trackEnd", async (player, track, reason) => {
        try {
          const localPath = track?.userData?.localFilePath;
          if (!localPath) return;

          if (player.repeatMode === "track" || player.repeatMode === "queue") {
            console.log(
              `[CLEANUP] Repeat active (${player.repeatMode}), not removing ${localPath}`
            );
            return;
          }

          const stillReferenced =
            Array.isArray(player.queue?.tracks) &&
            player.queue.tracks.some(
              (t) => t?.userData?.localFilePath === localPath
            );

          if (stillReferenced) {
            console.log(
              `[CLEANUP] File ${localPath} still referenced in queue — not deleting.`
            );
            return;
          }

          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log(`[INFO] Temporary file deleted: ${localPath}`);
          }
        } catch (e) {
          console.error("Error in cleanup trackEnd:", e);
        }
      });
    };

    try {
      const searchResult = await player.search(
        { query: attachment.url },
        interaction.user
      );

      if (!searchResult || !searchResult.tracks.length) {
        throw new Error("Lavalink returned no tracks.");
      }

      const track = searchResult.tracks[0];

      const replyMsg = await interaction
        .editReply({
          content: "⏳ Loading your file...",
          fetchReply: true,
        })
        .catch(() => null);

      if (replyMsg) {
        try {
          player.set("loadingMessage", replyMsg);
        } catch (e) {}
      }

      const isPlayingImmediately = await addTrackToQueueAndPlay(
        player,
        track,
        interaction,
        attachment
      );

      if (isPlayingImmediately) {
        if (!player.playing && !player.paused) {
          try {
            await player.play();
          } catch (e) {
            /* ignore */
          }
        }
        return;
      }
    } catch (error) {
      console.error(
        "Error in playfile (Attempt 1 - Direct Stream):",
        (error && (error.message || error.toString())) || error
      );

      let localFilePath = null;
      try {
        await interaction
          .editReply({
            content:
              "⏳ Direct attempt failed. Trying to download and process the file locally (fallback)... This may take up to ~2 minutes.",
          })
          .catch(() => {});

        const tempDir = path.join(__dirname, "..", "temp_audio_cache");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const localFileName = `${Date.now()}-${interaction.id}-${
          attachment.name
        }`;
        localFilePath = path.join(tempDir, localFileName);

        await downloadWithRetry(attachment.url, localFilePath, 0.2, 120000, 1);

        if (!fs.existsSync(localFilePath)) {
          console.error(
            "Fallback: expected file was not found on disk:",
            localFilePath
          );
          player.destroy();
          return sendError(
            "❌ An error occurred while processing the file locally."
          );
        }

        const stats = fs.statSync(localFilePath);
        console.log(
          "Local file saved. Path:",
          localFilePath,
          "Size:",
          stats.size
        );

        const baseUrl = global.localAudioServerUrl.endsWith("/")
          ? global.localAudioServerUrl
          : `${global.localAudioServerUrl}/`;
        const fileUrl = `${baseUrl}${encodeURIComponent(localFileName)}`;

        if (!global.localAudioServerUrl) {
          console.error(
            "Fallback failed: global.localAudioServerUrl is not set. (Is Ngrok token missing for remote Lavalink?)"
          );
          try {
            if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
          } catch (e) {}
          player.destroy();
          return sendError(
            "❌ The bot is not configured correctly to handle local files with a remote music server."
          );
        }

        console.log(
          "Attempting to load local file via URL to Lavalink:",
          fileUrl
        );

        const localSearchResult = await player.search(
          { query: fileUrl },
          interaction.user
        );

        console.log(
          "localSearchResult:",
          JSON.stringify(
            localSearchResult && {
              loadType: localSearchResult.loadType,
              tracks: (localSearchResult.tracks || []).length,
            },
            null,
            2
          )
        );

        if (!localSearchResult || !localSearchResult.tracks.length) {
          try {
            if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
          } catch (e) {}
          player.destroy();
          return sendError("❌ Failed to process the file locally.");
        }

        const track = localSearchResult.tracks[0];

        track.userData = Object.assign(track.userData || {}, {
          localFilePath,
          localFileName,
          isFile: true,
          interaction: interaction,
          rawFileName: attachment.name,
          displayUri: attachment.url,
        });

        ensureFileCleanupListener();

        const replyMsg = await interaction
          .editReply({
            content: "⏳ Loading your file...",
            fetchReply: true,
          })
          .catch(() => null);

        if (replyMsg) {
          try {
            player.set("loadingMessage", replyMsg);
          } catch (e) {}
        }

        const playedNow = await addTrackToQueueAndPlay(
          player,
          track,
          interaction,
          attachment
        );

        if (!playedNow) {
        }

        return;
      } catch (downloadError) {
        console.error(
          "Error in playfile (Manual Download):",
          (downloadError &&
            (downloadError.message || downloadError.toString())) ||
            downloadError
        );
        try {
          if (localFilePath && fs.existsSync(localFilePath))
            fs.unlinkSync(localFilePath);
        } catch (e) {}

        return;
        sendError(
          "❌ Failed to download/process the file. The connection may be unstable. Please try again."
        );
      }

      await sendError(
        "❌ Could not process this file. Please make sure it is not corrupted."
      );
    }
  },
};
