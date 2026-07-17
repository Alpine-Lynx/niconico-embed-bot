'use strict';

const http = require('node:http');
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} = require('discord.js');

const { convertedLinksFromMessage } = require('./link-utils');

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const PORT = Number(process.env.PORT || 8000);
const USER_COOLDOWN_MS = 3000;
const cooldowns = new Map();

function userIsCoolingDown(userId) {
  const now = Date.now();
  const previous = cooldowns.get(userId) || 0;
  cooldowns.set(userId, now);

  if (cooldowns.size > 1000) {
    const cutoff = now - USER_COOLDOWN_MS * 4;
    for (const [id, time] of cooldowns) {
      if (time < cutoff) cooldowns.delete(id);
    }
  }

  return now - previous < USER_COOLDOWN_MS;
}

function createHealthServer(client) {
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      const ok = client.isReady();
      res.statusCode = ok ? 200 : 503;
      res.end(JSON.stringify({ ok }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
}

async function main() {
  if (!TOKEN) {
    console.error('DISCORD_TOKEN が設定されていません。');
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
    allowedMentions: { parse: [], repliedUser: false },
  });

  client.once('ready', readyClient => {
    console.log(`✅ ${readyClient.user.tag} がオンラインになりました。`);
    readyClient.user.setActivity('ニコニコ・Bilibiliリンク', {
      type: ActivityType.Watching,
    });
  });

  client.on('messageCreate', async message => {
    if (message.author.bot || message.webhookId) return;
    if (!message.content) return;

    const links = convertedLinksFromMessage(message.content);
    if (links.length === 0) return;
    if (userIsCoolingDown(message.author.id)) return;

    try {
      // A plain proxy URL is intentional: Discord itself creates the playable
      // media card from the proxy service metadata. A custom bot embed cannot
      // define Discord's video player field.
      await message.reply({
        content: links.join('\n'),
        allowedMentions: { parse: [], repliedUser: false },
      });
    } catch (error) {
      console.error('リンク返信に失敗しました:', error?.message || error);
    }
  });

  client.on('error', error => {
    console.error('Discord client error:', error?.message || error);
  });

  const server = createHealthServer(client);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ HTTP server listening on 0.0.0.0:${PORT}`);
  });

  const shutdown = async signal => {
    console.log(`${signal} を受信。終了します。`);
    server.close();
    client.destroy();
    setTimeout(() => process.exit(0), 250).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  try {
    await client.login(TOKEN);
  } catch (error) {
    console.error('❌ Discordへのログインに失敗しました。Tokenを確認してください。');
    server.close();
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

