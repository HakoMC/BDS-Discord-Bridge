require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const bedrock = require("bedrock-protocol");
const axios = require("axios");

let playerList = [];

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const client = bedrock.createClient({
  host: process.env.MC_IP, // optional
  port: Number(process.env.MC_PORT), // optional, default 19132
  username: "DISCORD", // the username you want to join as, optional if online mode
  offline: true, // optional, default false. if true, do not login with Xbox Live. You will not be asked to sign-in if set to true.
});

client.on("text", (packet) => {
  if (packet.message === ".list") {
    const playerCount = playerList.length;
    const playerNames = playerList.map((player) => player.name).join(", ");
    client.queue("text", {
      type: "chat",
      needs_translation: false,
      source_name: client.username,
      xuid: "",
      platform_chat_id: "",
      filtered_message: "",
      message: `オンラインのプレイヤー (${playerCount}人): ${playerNames}`,
    });
    sendDiscordMessage(
      `オンラインのプレイヤー (${playerCount}人): ${playerNames}`,
    );
    playerList.forEach((item) => {
      console.log(`Name: ${item.name}, UUID: ${item.uuid}`);
    });
  }
  if (packet.source_name === "DISCORD") return;
  if (packet.type !== "chat") return;
  const message = `<${packet.source_name}> ${packet.message}`;
  sendDiscordMessage(message);
  console.log(message);
});

client.on("player_list", (packet) => {
  if (packet.records.type === "add") {
    packet.records.records.forEach((record) => {
      const existingPlayer = playerList.find(
        (player) => player.uuid === record.uuid,
      );
      if (!existingPlayer) {
        const newPlayer = { name: record.username, uuid: record.uuid };
        playerList.push(newPlayer);
        const embedData = {
          embeds: [
            {
              description: `${record.username}が参加しました！`,
              color: 9498256,
            },
          ],
        };
        sendDiscordEmbeds(embedData);
      }
    });
  } else if (packet.records.type === "remove") {
    packet.records.records.forEach((record) => {
      const playerName = findPlayerName(record.uuid);
      playerList = playerList.filter((player) => player.uuid !== record.uuid);
      const embedData = {
        embeds: [
          {
            description: `${playerName}が退出しました！`,
            color: 15548997,
          },
        ],
      };
      sendDiscordEmbeds(embedData);
    });
  }
});

function findPlayerName(uuid) {
  const player = playerList.find((player) => player.uuid === uuid);
  return player ? player.name : "不明なプレイヤー";
}

discordClient.on("ready", () => {
  console.log(`Logged in as ${discordClient.user.tag}!`);
});

discordClient.on("messageCreate", (message) => {
  // 指定されたチャンネル以外からのメッセージは無視
  if (message.channelId !== process.env.DISCORD_CHANNEL_ID) return;

  if (message.author.bot) return; // ボットのメッセージは無視

  if (message.content === ".list") {
    const playerCount = playerList.length;
    const playerNames = playerList.map((player) => player.name).join(", ");
    sendDiscordMessage(
      `オンラインのプレイヤー (${playerCount}人): ${playerNames}`,
    );
    playerList.forEach((item) => {
      console.log(`Name: ${item.name}, UUID: ${item.uuid}`);
    });
    return;
  }

  console.log(
    `Discord message: ${message.author.displayName}: ${message.content}`,
  );

  let author = message.author.displayName;
  let content = message.content;

  if (client) {
    client.queue("text", {
      type: "chat",
      needs_translation: false,
      source_name: client.username,
      xuid: "",
      platform_chat_id: "",
      filtered_message: "",
      message: `[${author}] ${content}`,
    });
    console.log("Message sent to Minecraft");
  } else {
    console.log("Minecraft player not connected");
  }
});

discordClient.login(process.env.DISCORD_TOKEN);

async function sendDiscordMessage(message) {
  try {
    await axios.post(process.env.DISCORD_WEBHOOK, {
      content: message,
    });
  } catch (error) {
    console.error("Discordへの送信エラー:", error);
  }
}

async function sendDiscordEmbeds(embedData) {
  try {
    await axios.post(process.env.DISCORD_WEBHOOK, embedData);
  } catch (error) {
    console.error("Discordへの送信エラー:", error);
  }
}

process.on("SIGINT", async () => {
  try {
    await Promise.race([
      new Promise((resolve) => {
        client.close();
        client.once("close", resolve);
      }),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);

    console.log("切断しました");
    process.exit(0);
  } catch (error) {
    console.error("切断中にエラーが発生しました:", error);
    process.exit(1);
  }
});
