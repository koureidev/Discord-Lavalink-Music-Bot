process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const express = require("express");
const ngrok = require("ngrok");
const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  Events,
} = require("discord.js");
const { LavalinkManager } = require("lavalink-client");

const {
  BOT_TOKEN,
  CLIENT_ID,
  LAVALINK_HOST,
  LAVALINK_PORT,
  LAVALINK_PASSWORD,
  LAVALINK_SECURE,
  EMBED_COLOR,
  FALLBACK_THUMBNAIL_URL,
  NGROK_AUTHTOKEN,
} = process.env;

const FALLBACK_THUMBNAIL_FILENAME = "fallback-thumbnail.jpg";
const TEMP_ASSETS_DIR = path.join(__dirname, "temp_assets");
const FALLBACK_THUMBNAIL_PATH = path.join(
  TEMP_ASSETS_DIR,
  FALLBACK_THUMBNAIL_FILENAME
);

const LOCAL_AUDIO_PORT = 8080;
global.localAudioServerUrl = "";

async function setupAudioServerUrl() {
  if (
    !LAVALINK_HOST ||
    LAVALINK_HOST === "localhost" ||
    LAVALINK_HOST === "127.0.0.1"
  ) {
    global.localAudioServerUrl = `http://127.0.0.1:${LOCAL_AUDIO_PORT}`;
    console.log(
      `[AUDIO FALLBACK] Lavalink is local. Using URL: ${global.localAudioServerUrl}`
    );
    return;
  }

  if (NGROK_AUTHTOKEN) {
    try {
      console.log(
        "[AUDIO FALLBACK] Lavalink is remote. Attempting to start Ngrok tunnel..."
      );
      const url = await ngrok.connect({
        proto: "http",
        addr: LOCAL_AUDIO_PORT,
        authtoken: NGROK_AUTHTOKEN,
      });
      global.localAudioServerUrl = url;
      console.log(
        `[AUDIO FALLBACK] Ngrok tunnel started! Public URL: ${global.localAudioServerUrl}`
      );
    } catch (error) {
      console.error(
        "[FATAL ERROR] Failed to start Ngrok. Local audio fallback will not work.",
        error
      );
      // This is optional. Uncomment the line below to make the bot stop if Ngrok is essential and fails.
      // process.exit(1);
    }
  } else {
    console.warn(
      "[WARNING] Lavalink is remote, but NGROK_AUTHTOKEN is not set in the .env file."
    );
    console.warn("[WARNING] The /playfile command will NOT work.");
  }
}

function startLocalAudioServer() {
  if (!global.localAudioServerUrl) {
    console.log(
      "[AUDIO FALLBACK] Server not started because no valid URL was configured (e.g., missing Ngrok token for remote Lavalink)."
    );
    return;
  }
  const app = express();
  const tempDir = path.join(__dirname, "temp_audio_cache");
  app.use(express.static(tempDir));

  app.listen(LOCAL_AUDIO_PORT, "0.0.0.0", () => {
    console.log(
      `🎵 Local audio server is running on port ${LOCAL_AUDIO_PORT}.`
    );
    console.log(`Lavalink will access it via: ${global.localAudioServerUrl}`);
  });
}

async function prepareFallbackThumbnail() {
  if (fs.existsSync(FALLBACK_THUMBNAIL_PATH)) {
    console.log("[INFO] Fallback image already exists locally.");
    return;
  }
  try {
    if (!fs.existsSync(TEMP_ASSETS_DIR)) {
      fs.mkdirSync(TEMP_ASSETS_DIR, { recursive: true });
    }
    console.log(
      `[INFO] Downloading fallback image from ${FALLBACK_THUMBNAIL_URL}...`
    );
    const response = await axios({
      method: "get",
      url: FALLBACK_THUMBNAIL_URL,
      responseType: "stream",
    });
    const writer = fs.createWriteStream(FALLBACK_THUMBNAIL_PATH);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(
          `[INFO] Fallback image saved to ${FALLBACK_THUMBNAIL_PATH}`
        );
        resolve();
      });
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("[ERROR] Failed to download fallback image:", error.message);
  }
}

const MIN_VISIBLE_TITLE_LENGTH = 40;
function padVisibleText(text, minLen = MIN_VISIBLE_TITLE_LENGTH) {
  if (!text) text = "";
  const visible = text.trim();
  if (visible.length >= minLen) return visible;
  const fillerChar = "\u2800";
  return visible + fillerChar.repeat(minLen - visible.length);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.activeInteractions = new Set();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`[INFO] Command /${command.data.name} loaded.`);
  } else {
    console.log(`[WARN] The command at ${filePath} has a problem.`);
  }
}

console.log("DEBUG VARS =>", {
  LAVALINK_HOST: process.env.LAVALINK_HOST,
  LAVALINK_PORT: process.env.LAVALINK_PORT,
  LAVALINK_PASSWORD: "***",
});

client.lavalink = new LavalinkManager({
  nodes: [
    {
      id: "Main Node",
      host: LAVALINK_HOST,
      port: Number(LAVALINK_PORT || 443),
      authorization: LAVALINK_PASSWORD,
      secure: LAVALINK_SECURE === "true",
    },
  ],
  sendToShard: (guildId, payload) =>
    client.guilds.cache.get(guildId)?.shard?.send(payload),
  client: { id: CLIENT_ID, username: "Music Bot" },
  requestTimeout: 50000,
  autoSkip: true,
  playerOptions: {
    clientBasedPositionUpdate: true,
    onDisconnect: { autoReconnect: true, destroyPlayer: false },
    onEmptyQueue: { destroyAfterMs: 60_000 },
  },
});

client.lavalink.on("trackStart", async (player, track) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (!channel) return;

  if (track.userData?.resumeSkipFix === "true") {
    const oldMsg = player.get("nowPlayingMessage");
    if (oldMsg && !oldMsg.deleted) await oldMsg.delete().catch(() => {});
    delete track.userData.resumeSkipFix;
    return;
  }

  async function hasNewerMessages(channel, message) {
    try {
      if (!message || message.deleted) return false;
      const fetched = await channel.messages.fetch({
        after: message.id,
        limit: 1,
      });
      return fetched && fetched.size > 0;
    } catch (e) {
      console.warn("hasNewerMessages failed:", e?.message || e);
      return false;
    }
  }

  const interaction = track.userData?.interaction;
  const isFile = !!track.userData?.isFile;

  let rawTitle = track.info.title;
  if (!rawTitle || rawTitle.toLowerCase() === "unknown title") {
    if (track.userData?.rawFileName) {
      rawTitle = path.parse(track.userData.rawFileName).name;
    } else {
      rawTitle = "Untitled";
    }
  }

  const paddedTitle = padVisibleText(rawTitle);

  const displayUri = track.userData?.displayUri || track.info.uri;

  const description = isFile
    ? `📁 [${paddedTitle}](${displayUri})`
    : `[${paddedTitle}](${displayUri})`;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR || "#FFB6C1")
    .setTitle("▶️ Now Playing")
    .setDescription(description)
    .addFields(
      {
        name: "Requested by",
        value: `${track.requester || "Unknown"}`,
        inline: true,
      },
      {
        name: "Duration",
        value: formatDuration(track.info.duration),
        inline: true,
      }
    )
    .setTimestamp();

  const messagePayload = { content: "", embeds: [embed], components: [] };

  if (track.info && track.info.artworkUrl) {
    embed.setThumbnail(track.info.artworkUrl);
  } else if (fs.existsSync(FALLBACK_THUMBNAIL_PATH)) {
    embed.setThumbnail(`attachment://${FALLBACK_THUMBNAIL_FILENAME}`);
    messagePayload.files = [FALLBACK_THUMBNAIL_PATH];
  }

  let loadingMsg = player.get("loadingMessage");
  if (loadingMsg && !loadingMsg.deleted) {
    try {
      const loadingHasNewer = await hasNewerMessages(channel, loadingMsg);
      if (!loadingHasNewer) {
        const edited = await loadingMsg.edit(messagePayload).catch(() => null);
        if (edited) {
          player.set("nowPlayingMessage", edited);
          try {
            player.set("loadingMessage", null);
          } catch (e) {}
          if (track.userData?.interaction) delete track.userData.interaction;
          return;
        }
      } else {
        await loadingMsg.delete().catch(() => {});
        try {
          player.set("loadingMessage", null);
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Error handling loadingMsg:", e?.message || e);
      try {
        loadingMsg.delete().catch(() => {});
      } catch (e) {}
      try {
        player.set("loadingMessage", null);
      } catch (e) {}
    }
  }

  let oldMsg = player.get("nowPlayingMessage");
  if (oldMsg && !oldMsg.deleted) {
    try {
      const oldHasNewer = await hasNewerMessages(channel, oldMsg);
      if (!oldHasNewer) {
        const edited = await oldMsg.edit(messagePayload).catch(() => null);
        if (edited) {
          player.set("nowPlayingMessage", edited);
          if (track.userData?.interaction) delete track.userData.interaction;
          return;
        }
      } else {
        await oldMsg.delete().catch(() => {});
      }
    } catch (e) {
      console.warn("Error handling nowPlayingMessage:", e?.message || e);
      try {
        oldMsg.delete().catch(() => {});
      } catch (e) {}
    }
  }

  let newMsg;
  try {
    if (interaction && !(interaction.replied || interaction.deferred)) {
      newMsg = await interaction.reply({ ...messagePayload, fetchReply: true });
    } else {
      newMsg = await channel.send(messagePayload);
    }
    player.set("nowPlayingMessage", newMsg);
  } catch (e) {
    console.error(
      "Error sending 'Now Playing' message, attempting fallback.",
      e.message || e
    );
    try {
      newMsg = await channel.send(messagePayload);
      player.set("nowPlayingMessage", newMsg);
    } catch (finalError) {
      console.error(
        "Final failure sending 'Now Playing' message.",
        finalError.message || finalError
      );
    }
  }

  if (track.userData?.interaction) delete track.userData.interaction;
});

client.lavalink.on("trackStuck", async (player, track, thresholdMs) => {
  console.warn(`⚠️ Track got stuck (${thresholdMs}ms): ${track.info?.title}`);
  try {
    await player.stop();
  } catch (err) {
    console.error("Error stopping player after trackStuck:", err);
  }
});

client.lavalink.on("trackException", async (player, track, error) => {
  console.error(`💥 Error playing ${track.info?.title}:`, error);
  try {
    await player.stop();
  } catch (err) {
    console.error("Error stopping player after trackException:", err);
  }
});

client.lavalink.on("queueEnd", async (player) => {
  if (player.repeatMode === "track" || player.repeatMode === "queue") {
    console.log("[QUEUE END] Ignored — repeat mode is active.");
    return;
  }

  const channel = client.channels.cache.get(player.textChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR || "#FFB6C1")
    .setTitle("📭 Queue Finished")
    .setDescription(
      "All songs in the Queue have been played.\nThe bot will leave the voice channel in **1 minute** if nothing else is added."
    );

  channel.send({ embeds: [embed] }).catch(() => {});
});

async function startBot() {
  await setupAudioServerUrl();

  startLocalAudioServer();

  client.login(BOT_TOKEN);
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  await prepareFallbackThumbnail();
  await client.lavalink.init({ ...client.user });
});

client.lavalink.nodeManager.on("connect", (node) => {
  console.log(`✅ Lavalink node "${node.options.id}" connected.`);
});

setTimeout(() => {
  try {
    const nm = client.lavalink.nodeManager ?? client.lavalink;
    const node =
      nm && nm.nodes
        ? typeof nm.nodes.first === "function"
          ? nm.nodes.first()
          : nm.nodes.values().next().value
        : null;
    if (node) {
      console.log(
        "[LAVALINK SNAPSHOT 5s]",
        node.options?.id,
        "connected=",
        node.connected,
        "ping=",
        node.ping,
        "stats=",
        node.stats
          ? { players: node.stats.players, uptime: node.stats.uptime }
          : null
      );
    } else {
      console.log("[LAVALINK SNAPSHOT 5s] no node found");
    }
  } catch (e) {
    console.warn("[LAVALINK SNAPSHOT 5s] error", e);
  }
}, 5000);

setTimeout(() => {
  try {
    const nm = client.lavalink.nodeManager ?? client.lavalink;
    const node =
      nm && nm.nodes
        ? typeof nm.nodes.first === "function"
          ? nm.nodes.first()
          : nm.nodes.values().next().value
        : null;
    if (node) {
      console.log(
        "[LAVALINK SNAPSHOT 15s]",
        node.options?.id,
        "connected=",
        node.connected,
        "ping=",
        node.ping,
        "stats=",
        node.stats
          ? { players: node.stats.players, uptime: node.stats.uptime }
          : null
      );
    }
  } catch (e) {}
}, 15000);

client.lavalink.nodeManager.on("error", (node, error) => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(
    `✖ Error on node "${node.options.id}": ${error?.message || error}`
  );
  console.log(
    "💡 Tip: check if Lavalink is running and if the host/port/password in your .env file are correct."
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", reason);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!(interaction.isChatInputCommand() || interaction.isContextMenuCommand()))
    return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(
      `No command matching "${interaction.commandName}" was found.`
    );
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error executing "${interaction.commandName}":`, error);
    const errorMsg = {
      content: "❌ An error occurred while executing this command!",
      embeds: [],
      components: [],
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMsg).catch(console.error);
    } else {
      await interaction
        .reply({ ...errorMsg, ephemeral: true })
        .catch(console.error);
    }
  }
});

client.on("raw", (d) => client.lavalink.sendRawData(d));

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

startBot();
