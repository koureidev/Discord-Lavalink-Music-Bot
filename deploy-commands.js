const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const { BOT_TOKEN, CLIENT_ID } = process.env;

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
    console.log(
      `[INFO] Command /${command.data.name} prepared for deployment.`
    );
  } else {
    console.log(
      `[WARNING] The command in ${file} is missing the "data" or "execute" property.`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log(
      `\nStarting deployment of ${commands.length} application (/) commands.`
    );

    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(
      `✅ Success! ${data.length} application (/) commands have been reloaded.`
    );
  } catch (error) {
    console.error(error);
  }
})();
