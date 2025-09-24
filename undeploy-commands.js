const { REST, Routes } = require("discord.js");
require("dotenv").config();

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log("🗑️ Removing all registered commands...");

    await rest.put(
      Routes.applicationCommands(
        process.env.CLIENT_ID
      ),
      { body: [] }
    );

    console.log("✅ All commands have been removed successfully!");
  } catch (error) {
    console.error("❌ Error removing commands:", error);
  }
})();
