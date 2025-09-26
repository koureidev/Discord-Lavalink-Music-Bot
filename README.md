[![License: 0BSD](https://img.shields.io/badge/License-0BSD-blue?style=for-the-badge)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![discord.js v14](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Docker Ready](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Lavalink](https://img.shields.io/badge/Lavalink-supported-FF7139?style=for-the-badge&logo=java&logoColor=white)](https://github.com/lavalink-devs/Lavalink)

# 🎵 Discord Music Bot

A powerful, feature-rich Discord music bot built with **Discord.js v14** and powered by **Lavalink**. Designed for high-quality audio playback, stability, and ease of use. This project provides a robust foundation for a personal or public music bot.

> ⚠️ **Disclaimer:** This project is intended for **educational purposes only**. It does not include any credentials, nor does it provide instructions on bypassing third-party services. Usage of this project with external services (e.g., YouTube, Spotify) may be subject to their Terms of Service. You are responsible for providing your own valid credentials obtained through official APIs.

This repository contains the source code for the bot itself. For the pre-configured Lavalink server used with this bot, check out the companion repository:

* **Bot Source:** [koureidev/discord-lavalink-music-bot](https://github.com/koureidev/discord-lavalink-music-bot)
* **Lavalink Server:** [koureidev/discord-lavalink-music-server](https://github.com/koureidev/discord-lavalink-music-server)

---

## ✨ Features

* **High-Quality Audio:** Leverages Lavalink for efficient and crystal-clear audio streaming.
* **Wide Source Support:**
  * **YouTube:** Play songs, playlists, and search directly (via OAuth credentials).
  * **Spotify:** Play songs, playlists, and albums with title matching via the Lavasrc plugin.
  * **Local Files:** Upload and play your own audio files (`.mp3`, `.ogg`, `.wav`, etc.).
* **Advanced Queue System:** View, shuffle, add, remove, and move tracks with intuitive commands.
* **Interactive Controls:** Paginated queue, interactive search results, and clear "Now Playing" messages.
* **Playback Control:** Standard commands like `play`, `pause`, `resume`, `skip`, and `stop`, plus seeking with `forward` and `rewind`.
* **Looping Modes:** Repeat a single track or the entire queue.
* **Robust Error Handling:** Smart fallbacks for local file playback and handlers for track exceptions to ensure smooth operation.
* **Clean & Modern:** Uses Discord's Slash Commands and Embeds for a seamless user experience.

---

## 🚀 Getting Started

To get the music bot running, you need two components: the **Lavalink Server** (the audio engine) and the **Discord Bot** itself. You must set them up in this order.

---

### ✅ Step 1: Set Up and Run the Lavalink Server

The bot requires a running Lavalink server to connect to. We provide a pre-configured, production-ready server that is fully automated and easy to set up.

➡️ **Go to the [Lavalink Server Repository](https://github.com/koureidev/discord-lavalink-music-server) and follow the instructions there first.**

Once the server is running, take note of its `host`, `port`, and `password` from its `.env` file. You will need them for the next step.

---

### ✅ Step 2: Set Up and Run the Discord Bot

Now that your Lavalink server is running, you can set up the bot to connect to it.

#### ⚡ Option A – Run with Docker (recommended)

1. **Install prerequisites:**
   * **Git** to clone the repository.
     - [Install Git](https://git-scm.com/downloads/)
   * **Docker** and **Docker Compose** must be installed. If you install Docker Desktop, compose will already be included.
     - [Install Docker](https://docs.docker.com/get-docker/)  
     - [Install Docker Compose](https://docs.docker.com/compose/install/)

2.  **Clone the repository:**
    ```bash
    git clone https://github.com/koureidev/discord-lavalink-music-bot.git
    cd discord-lavalink-music-bot
    ```

3.  **Configure environment variables:**  
    Copy `.env.example` to a new file named `.env`.
    ```bash
    cp .env.example .env
    ```
    Now, open `.env` in your favorite text editor. Fill in your `BOT_TOKEN` and `CLIENT_ID`, and make sure the `LAVALINK_HOST`, `LAVALINK_PORT`, and `LAVALINK_PASSWORD` match the values from your running Lavalink server (from Step 1).

4.  **Deploy Slash Commands:**
   Before using the bot for the first time (or if you updated/added a command), you must deploy its slash commands. The bot being online does not automatically register them with Discord.

    To deploy commands globally (available in all servers the bot is in):
    ```bash
    docker compose run --rm bot npm run deploy
    ```

    If you ever need to remove all commands:
    ```bash
    docker compose run --rm bot npm run undeploy
    ```

    ⚠️ **Note:** Global command deployment can take a few minutes to propagate across Discord. Be patient if commands don't appear instantly.

5.  **Build and start the bot:**
    ```bash
    docker compose up -d --build
    ```

---

#### ⚡ Option B – Run locally (manual setup)

1. **Install prerequisites:**  
   * **Node.js v18+**
   * **npm v11+**
     - Linux (Debian/Ubuntu):  
       ```bash
       sudo apt-get install nodejs npm git
       npm install -g npm
       ```  
     - Linux (Fedora/CentOS/Rocky):  
       ```bash
       sudo dnf install nodejs npm git
       npm install -g npm
       ```
       or
       ```bash
       sudo yum install nodejs npm git
       npm install -g npm
       ```

2.  **Clone the repository:**
    ```bash
    git clone https://github.com/koureidev/discord-lavalink-music-bot.git
    cd discord-lavalink-music-bot
    ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4.  **Configure environment variables:**  
    Copy `.env.example` to `.env`.
    ```bash
    cp .env.example .env
    ```
    Now, open `.env` in your favorite text editor. Fill in your `BOT_TOKEN` and `CLIENT_ID`, and make sure the `LAVALINK_HOST`, `LAVALINK_PORT`, and `LAVALINK_PASSWORD` match the values from your running Lavalink server (from Step 1).

5. **Slash Commands Deployment:**
   Before using the bot for the first time (or if you updated/added a command), you must deploy its slash commands. The bot being online does not automatically register them with Discord.

   To deploy commands globally (available in all servers the bot is in):
   ```bash
   npm run deploy
   ```

   If you ever need to remove all commands:
   ```bash
   npm run undeploy
   ```

   ⚠️ **Note:** Global command deployment can take a few minutes to propagate across Discord. Be patient if commands don't appear instantly.

7. **Run the bot:**
   ```bash
   npm start
   ```

---

## 🤖 Commands

The bot uses Slash Commands for all interactions. Here is a detailed list of available commands.

### Music & Playback

| Command                  | Description                                                                                                       | Usage                      |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------- |
| **/play** `<song>`       | Plays a song from YouTube (URL or search term) or a Spotify link. Adds to the queue if a song is already playing. | `/play <song name or URL>` |
| **/pause**               | Pauses the currently playing track.                                                                               | `/pause`                   |
| **/resume**              | Resumes a paused track.                                                                                           | `/resume`                  |
| **/skip** `[amount]`     | Skips the current song. You can optionally specify how many songs to skip.                                        | `/skip` or `/skip 2`       |
| **/stop**                | Stops playback, clears the entire queue, and disconnects the bot from the voice channel.                          | `/stop`                    |
| **/forward** `<seconds>` | Fast-forwards the current track by a specified number of seconds.                                                 | `/forward 30`              |
| **/rewind** `<seconds>`  | Rewinds the current track by a specified number of seconds.                                                       | `/rewind 15`               |
| **/lock**                | Loops the current track indefinitely until `/unlock` is used.                                                     | `/lock`                    |
| **/unlock**              | Disables all active loop modes (track or queue).                                                                  | `/unlock`                  |

### Queue Management

| Command                            | Description                                                                     | Usage                               |
| :--------------------------------- | :------------------------------------------------------------------------------ | :---------------------------------- |
| **/queue view**                    | Displays the current song and the list of upcoming tracks in a paginated embed. | `/queue view`                       |
| **/queue add** `<song> [position]` | Adds a song to the queue. You can optionally specify a position to insert it.   | `/queue add <song name> position:3` |
| **/queue shuffle**                 | Randomizes the order of all tracks in the queue.                                | `/queue shuffle`                    |
| **/queue remove** `<position>`     | Removes a track from the queue at the specified position.                       | `/queue remove 3`                   |
| **/queue move** `<from> <to>`      | Moves a track from one position in the queue to another.                        | `/queue move from:5 to:2`           |
| **/queue loop**                    | Toggles looping for the entire queue. `/unlock` works there too.                | `/queue loop`                       |

### Search Commands

| Command                       | Description                                                                              | Usage                           |
| :---------------------------- | :--------------------------------------------------------------------------------------- | :------------------------------ |
| **/search-youtube** `<query>` | Searches YouTube for your query and displays the top 5 results with interactive buttons. | `/search-youtube <song name>`   |
| **/search-spotify** `<query>` | Searches Spotify for your query and displays the top 5 results with interactive buttons. | `/search-spotify <song name>` |

### File Playback

| Command                             | Description                                                    | Usage                                                              |
| :---------------------------------- | :------------------------------------------------------------- | :----------------------------------------------------------------- |
| **/playfile** `<file>`              | Plays an audio file that you upload directly with the command. | `/playfile [attach your file]`                                     |
| **Play this file** `(Context Menu)` | Plays an audio file from an existing message.                  | `Right-click a message with an audio file > Apps > Play this file` |

### Utility Commands

| Command   | Description                                                                                 | Usage   |
| :-------- | :------------------------------------------------------------------------------------------ | :------ |
| **/help** | Shows a paginated list of all available commands and their descriptions.                    | `/help` |
| **/ping** | Checks the bot's latency, Discord API latency, and the status of the Lavalink music server. | `/ping` |

---

## 🛠️ Advanced Configuration

### Disabling YouTube Playlist Scraping (Optional)

As mentioned in the features list, this bot uses `play-dl` as a workaround to fetch song information from YouTube playlists. This functionality is isolated and can be easily disabled if you prefer to rely solely on Lavalink's native source managers.

**Consequence:** If you disable this, commands like `/play` and `/queue add` will no longer expand YouTube playlist links into individual songs. The rest of the bot's functionality, including playing single YouTube/Spotify tracks and search, will remain unaffected.

**How to disable:**

1.  Open the command files: `commands/play.js` and `commands/queue.js`.
2.  In both files, find and remove (or comment out) the line that imports the utility:
    ```javascript
    const { fetchYouTubePlaylist } = require("../utils/playlist");
    ```
3.  In both files, find and remove (or comment out) the entire code block responsible for handling playlists. It looks like this:
    ```javascript
    // In play.js and queue.js
    if (query.includes("list=")) {
      // entire block of code
    }
    ```
4.  (Optional but recommended) You can now delete the `utils/playlist.js` file, as it will no longer be in use.

---

## 🙏 Acknowledgements

This project would not be possible without the incredible work of the open-source community. Special thanks to:

* **[Lavalink](https://github.com/lavalink-devs/Lavalink):** The powerful, standalone audio sending node used for all audio playback.
* **[lavalink-client](https://github.com/lavalink-devs/lavalink-client):** A feature-rich and stable Lavalink client for Node.js.
* **[Lavasrc](https://github.com/topi314/LavaSrc):** A Lavalink plugin that provides support for Spotify, Deezer, and Apple Music.
* **[youtube-source](https://github.com/lavalink-devs/youtube-source):** An official Lavalink plugin for sourcing audio from YouTube.
