const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function fmtVersion(info) {
  if (!info) return "N/A";
  if (typeof info === "string") return info;
  try {
    if (info.semver) return info.semver;
    if (info.version)
      return typeof info.version === "string"
        ? info.version
        : JSON.stringify(info.version);
    return JSON.stringify(info);
  } catch (e) {
    return String(info);
  }
}

async function httpPing(nodeOptions) {
  try {
    if (!nodeOptions) return null;
    const secure = nodeOptions.secure === true;
    const host =
      nodeOptions.host ||
      nodeOptions.hostname ||
      nodeOptions.address ||
      "127.0.0.1";
    const port = nodeOptions.port || 2333;
    const proto = secure ? "https" : "http";
    const url = `${proto}://${host}:${port}/version`;

    const passwd = process.env.LAVALINK_PASSWORD;

    const headers = {};
    if (passwd) headers["Authorization"] = passwd;

    const t0 = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res || !res.ok) {
      return null;
    }
    await res.text().catch(() => {});
    return Date.now() - t0;
  } catch (e) {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check latencies and music server status."),

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      const reply = await interaction.fetchReply();
      const botLatency = reply.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);

      let node;
      try {
        const nm = client.lavalink?.nodeManager ?? client.lavalink;
        if (nm) {
          if (nm.nodes && typeof nm.nodes.first === "function")
            node = nm.nodes.first();
          else if (nm.nodes && typeof nm.nodes.values === "function")
            node = nm.nodes.values().next().value;
          else node = nm;
        }
      } catch (e) {
        node = undefined;
      }

      let managerPlayersCount = 0;
      let managerPlayingCount = 0;
      try {
        const playersColl =
          client.lavalink?.players ?? client.lavalink?.manager?.players ?? null;
        if (playersColl) {
          if (
            typeof playersColl.size === "number" &&
            typeof playersColl.values === "function"
          ) {
            managerPlayersCount = playersColl.size;
            managerPlayingCount = Array.from(playersColl.values()).filter(
              (p) => {
                try {
                  if (p.playing === true) return true;
                  if (p.paused === true) return false;
                  if (p.queue && p.queue.current) return true;
                  if (p.state && p.state.playing === true) return true;
                  return false;
                } catch (e) {
                  return false;
                }
              }
            ).length;
          } else if (typeof playersColl === "object") {
            const arr = Object.values(playersColl);
            managerPlayersCount = arr.length;
            managerPlayingCount = arr.filter(
              (p) =>
                p &&
                (p.playing ||
                  (p.queue && p.queue.current) ||
                  (p.state && p.state.playing))
            ).length;
          }
        }
      } catch (e) {
        managerPlayersCount = 0;
        managerPlayingCount = 0;
      }

      let statsPlayers = null;
      let statsPlaying = null;
      if (node && node.stats) {
        statsPlayers = Number.isFinite(node.stats.players)
          ? node.stats.players
          : null;
        statsPlaying = Number.isFinite(node.stats.playingPlayers)
          ? node.stats.playingPlayers
          : null;
      }

      let pingMs = NaN;
      try {
        if (node && typeof node.ping === "number" && node.ping > 0)
          pingMs = node.ping;
        else if (
          node &&
          node.stats &&
          typeof node.stats.ping === "number" &&
          node.stats.ping > 0
        )
          pingMs = node.stats.ping;
        else {
          const measured = await httpPing(node?.options ?? node);
          if (typeof measured === "number" && Number.isFinite(measured))
            pingMs = measured;
        }
      } catch (e) {
        pingMs = NaN;
      }

      const playersText =
        managerPlayersCount > 0
          ? `${managerPlayersCount}`
          : statsPlayers !== null
          ? `${statsPlayers}`
          : "0";
      const playingText =
        managerPlayersCount > 0
          ? `${managerPlayingCount}`
          : statsPlaying !== null
          ? `${statsPlaying}`
          : "0";

      let statusEmoji = "🔴";
      let statusText = "Disconnected or not configured";
      let pingText = "N/A";
      if (node) {
        if (node.connected) {
          if (Number.isFinite(pingMs) && pingMs > 0) {
            statusEmoji = "🟢";
            statusText = "Connected";
            pingText = `${Math.round(pingMs)}ms`;
          } else {
            statusEmoji = "🟡";
            statusText = "Connected (waiting for ping)";
            pingText = "N/A";
          }
        } else {
          statusEmoji = "🔴";
          statusText = "Disconnected";
        }
      }

      let extra = "";
      try {
        const s = node?.stats ?? {};
        const info = node?.info ?? {};
        const playersShown =
          managerPlayersCount > 0 ? managerPlayersCount : s.players ?? 0;
        const playingShown =
          managerPlayersCount > 0 ? managerPlayingCount : s.playingPlayers ?? 0;
        const uptime =
          typeof s.uptime === "number"
            ? `${Math.round(s.uptime / 1000)}s`
            : s.uptime ?? "N/A";
        const cpuCores = s.cpu?.cores ?? "N/A";
        const memUsed = s.memory?.used
          ? `${Math.round((s.memory.used / 1024 / 1024) * 100) / 100}MB`
          : s.memory?.used ?? "N/A";
        const lvVer = fmtVersion(info.version ?? info);
        extra = `\nPlayers: ${playersShown} • Playing: ${playingShown} • Uptime: ${uptime}\nCPU cores: ${cpuCores} • Memory Used: ${memUsed}\nAPI Version: ${lvVer}`;
      } catch (e) {
        extra = "";
      }

      const nodeLabel = node
        ? node.options?.id ?? node.id ?? "Main Node"
        : "None";

      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("🏓 Pong!")
        .addFields(
          {
            name: "Bot Latency 🤖",
            value: `\`${botLatency}ms\``,
            inline: true,
          },
          {
            name: "API Latency 🌐",
            value: `\`${apiLatency}ms\``,
            inline: true,
          },
          {
            name: "Music Server 🎵",
            value: `**${nodeLabel}** — ${statusEmoji} ${statusText} (${pingText})${
              extra ? `\n${extra}` : ""
            }`,
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Error in /ping:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription("❌ Error fetching latencies."),
          ],
        });
      } else {
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription("❌ Error fetching latencies."),
          ],
        });
      }
    }
  },
};
