require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const bedrock = require("bedrock-protocol");
const axios = require("axios");

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
  if (packet.source_name === "DISCORD") return;
  if (packet.type !== "chat") return;
  const message = `<${packet.source_name}> ${packet.message}`;
  sendDiscordMessage(message);
  console.log(message);
});

// 初回接続時のプレイヤーリスト処理を制御するフラグ
let isInitialPlayerList = true;

// プレイヤー名を保持するためのMap
const playerMap = new Map();

client.on("player_list", (packet) => {
  if (packet.records.type === "add") {
    packet.records.records.forEach((record) => {
      // 初回接続時はプレイヤー名を記録するだけ
      if (isInitialPlayerList) {
        playerMap.set(record.uuid, record.username);
        return;
      }

      const embedData = {
        embeds: [
          {
            description: `${record.username}が参加しました！`,
            color: 9498256,
          },
        ],
      };
      sendDiscordEmbeds(embedData);
    });
    // 初回のプレイヤーリスト処理が完了したらフラグを更新
    isInitialPlayerList = false;
  }

  if (packet.records.type === "remove") {
    packet.records.records.forEach((record) => {
      // 保存していたプレイヤー名を使用
      const username = playerMap.get(record.uuid) || "不明なプレイヤー";

      const embedData = {
        embeds: [
          {
            description: `${username}が退出しました`,
            color: 15548997,
          },
        ],
      };

      // プレイヤーをMapから削除
      playerMap.delete(record.uuid);

      sendDiscordEmbeds(embedData);
    });
  }
});

discordClient.on("ready", () => {
  console.log(`Logged in as ${discordClient.user.tag}!`);
});

discordClient.on("messageCreate", (message) => {
  // 指定されたチャンネル以外からのメッセージは無視
  if (message.channelId !== process.env.DISCORD_CHANNEL_ID) return;

  if (message.author.bot) return; // ボットのメッセージは無視

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
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    console.log("切断しました");
    process.exit(0);
  } catch (error) {
    console.error("切断中にエラーが発生しました:", error);
    process.exit(1);
  }
});
