'use strict';

const http = require('node:http');
const { convertedLinksFromMessage } = require('./link-utils');

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const PORT = Number(process.env.PORT || 8000);

const DISCORD_API = 'https://discord.com/api/v10';
const DEFAULT_GATEWAY_URL = 'wss://gateway.discord.gg';

const INTENTS =
  (1 << 0)  | // GUILDS
  (1 << 9)  | // GUILD_MESSAGES
  (1 << 12) | // DIRECT_MESSAGES
  (1 << 15);  // MESSAGE_CONTENT

const USER_COOLDOWN_MS = 3000;
const MAX_COOLDOWN_ENTRIES = 1000;
const cooldowns = new Map();

let gatewayReady = false;
let gatewayUserTag = null;
let shuttingDown = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function userIsCoolingDown(userId) {
  const now = Date.now();
  const previous = cooldowns.get(userId) || 0;
  cooldowns.set(userId, now);

  if (cooldowns.size > MAX_COOLDOWN_ENTRIES) {
    const cutoff = now - USER_COOLDOWN_MS * 4;

    for (const [id, time] of cooldowns) {
      if (time < cutoff) cooldowns.delete(id);
    }
  }

  return now - previous < USER_COOLDOWN_MS;
}

async function discordRequest(path, options, retryCount = 0) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordVideoEmbedBot/1.4',
      ...(options.headers || {}),
    },
  });

  if (response.status === 429 && retryCount < 1) {
    let retryAfterMs = 1000;

    try {
      const body = await response.json();
      retryAfterMs = Math.min(
        Math.max(Number(body.retry_after || 1) * 1000, 250),
        10_000
      );
    } catch {
      // Use the default delay.
    }

    await sleep(retryAfterMs);
    return discordRequest(path, options, retryCount + 1);
  }

  return response;
}

async function replyToMessage(message, content) {
  const response = await discordRequest(
    `/channels/${encodeURIComponent(message.channel_id)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        content,
        message_reference: {
          message_id: message.id,
          fail_if_not_exists: false,
        },
        allowed_mentions: {
          parse: [],
          replied_user: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 500);
    throw new Error(`Discord REST ${response.status}: ${errorText}`);
  }
}

async function handleMessageCreate(message) {
  if (!message?.id || !message?.channel_id) return;
  if (message.author?.bot || message.webhook_id) return;
  if (typeof message.content !== 'string' || message.content.length === 0) return;

  const links = convertedLinksFromMessage(message.content);
  if (links.length === 0) return;

  const userId = message.author?.id;
  if (userId && userIsCoolingDown(userId)) return;

  try {
    await replyToMessage(message, links.join('\n'));
  } catch (error) {
    console.error('リンク返信に失敗しました:', error?.message || error);
  }
}

async function getGatewayUrl() {
  try {
    const response = await fetch(`${DISCORD_API}/gateway`, {
      headers: {
        'User-Agent': 'DiscordVideoEmbedBot/1.4',
      },
    });

    if (response.ok) {
      const body = await response.json();

      if (typeof body.url === 'string' && body.url.startsWith('wss://')) {
        return body.url;
      }
    }
  } catch (error) {
    console.warn('Gateway URL取得失敗。標準URLを使います:', error?.message || error);
  }

  return DEFAULT_GATEWAY_URL;
}

class DiscordGateway {
  constructor() {
    this.socket = null;
    this.sequence = null;
    this.sessionId = null;
    this.resumeGatewayUrl = null;
    this.heartbeatTimer = null;
    this.firstHeartbeatTimer = null;
    this.heartbeatAcked = true;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.fatal = false;
  }

  clearTimers() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.firstHeartbeatTimer) clearTimeout(this.firstHeartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.heartbeatTimer = null;
    this.firstHeartbeatTimer = null;
    this.reconnectTimer = null;
  }

  send(payload) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;

    this.socket.send(JSON.stringify(payload));
    return true;
  }

  sendHeartbeat() {
    if (!this.heartbeatAcked) {
      console.warn('Heartbeat ACKが来ないため再接続します。');

      try {
        this.socket?.close(4000, 'Heartbeat timeout');
      } catch {
        // Ignore close errors.
      }

      return;
    }

    this.heartbeatAcked = false;
    this.send({ op: 1, d: this.sequence });
  }

  startHeartbeat(intervalMs) {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
      throw new Error('Discordから不正なheartbeat_intervalを受信しました。');
    }

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.firstHeartbeatTimer) clearTimeout(this.firstHeartbeatTimer);

    this.heartbeatAcked = true;

    const jitterDelay = Math.floor(Math.random() * intervalMs);

    this.firstHeartbeatTimer = setTimeout(() => {
      this.sendHeartbeat();

      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, intervalMs);
    }, jitterDelay);
  }

  identify() {
    this.send({
      op: 2,
      d: {
        token: TOKEN,
        intents: INTENTS,
        properties: {
          os: process.platform,
          browser: 'discord-video-embed-bot',
          device: 'discord-video-embed-bot',
        },
        presence: {
          since: null,
          activities: [
            {
              name: 'ニコニコ・Bilibiliリンク',
              type: 3,
            },
          ],
          status: 'online',
          afk: false,
        },
      },
    });
  }

  resume() {
    this.send({
      op: 6,
      d: {
        token: TOKEN,
        session_id: this.sessionId,
        seq: this.sequence,
      },
    });
  }

  scheduleReconnect(delayOverrideMs = null) {
    if (shuttingDown || this.fatal || this.reconnectTimer) return;

    const baseDelay = Math.min(
      1000 * (2 ** Math.min(this.reconnectAttempts, 5)),
      30_000
    );
    const delay = delayOverrideMs ?? (baseDelay + Math.floor(Math.random() * 1000));

    this.reconnectAttempts += 1;

    console.log(`Discord Gatewayへ${Math.ceil(delay / 1000)}秒後に再接続します。`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        console.error('Gateway再接続失敗:', error?.message || error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  async handlePayload(payload) {
    if (typeof payload.s === 'number') {
      this.sequence = payload.s;
    }

    switch (payload.op) {
      case 0:
        if (payload.t === 'READY') {
          this.sessionId = payload.d?.session_id || null;
          this.resumeGatewayUrl = payload.d?.resume_gateway_url || null;
          this.reconnectAttempts = 0;
          gatewayReady = true;

          const username = payload.d?.user?.username;
          const discriminator = payload.d?.user?.discriminator;
          gatewayUserTag =
            username && discriminator && discriminator !== '0'
              ? `${username}#${discriminator}`
              : username || 'Discord Bot';

          console.log(`✅ ${gatewayUserTag} がオンラインになりました。`);
        } else if (payload.t === 'RESUMED') {
          this.reconnectAttempts = 0;
          gatewayReady = true;
          console.log('✅ Discord Gatewayセッションを再開しました。');
        } else if (payload.t === 'MESSAGE_CREATE') {
          await handleMessageCreate(payload.d);
        }
        break;

      case 1:
        this.sendHeartbeat();
        break;

      case 7:
        console.warn('Discordから再接続を要求されました。');
        this.socket?.close(4000, 'Reconnect requested');
        break;

      case 9:
        if (!payload.d) {
          this.sessionId = null;
          this.resumeGatewayUrl = null;
          this.sequence = null;
        }

        this.socket?.close(4000, 'Invalid session');
        break;

      case 10:
        this.startHeartbeat(payload.d?.heartbeat_interval);

        if (this.sessionId && this.sequence !== null) {
          this.resume();
        } else {
          this.identify();
        }
        break;

      case 11:
        this.heartbeatAcked = true;
        break;

      default:
        break;
    }
  }

  async connect() {
    if (shuttingDown || this.fatal) return;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const baseUrl = this.resumeGatewayUrl || await getGatewayUrl();
    const gatewayUrl = new URL(baseUrl);
    gatewayUrl.searchParams.set('v', '10');
    gatewayUrl.searchParams.set('encoding', 'json');

    console.log('Discord Gatewayへ接続します。');

    const socket = new WebSocket(gatewayUrl);
    this.socket = socket;

    socket.addEventListener('message', async event => {
      try {
        const payload = JSON.parse(String(event.data));
        await this.handlePayload(payload);
      } catch (error) {
        console.error('Gatewayメッセージ処理エラー:', error?.message || error);
      }
    });

    socket.addEventListener('error', () => {
      console.error('Discord Gateway WebSocketエラーが発生しました。');
    });

    socket.addEventListener('close', event => {
      this.clearTimers();
      gatewayReady = false;

      const code = Number(event.code || 0);
      console.warn(`Discord Gateway切断: code=${code}`);

      if ([4004, 4010, 4011, 4012, 4013, 4014].includes(code)) {
        this.fatal = true;

        if (code === 4004) {
          console.error('Bot Tokenが無効です。DISCORD_TOKENを確認してください。');
        } else if (code === 4014) {
          console.error(
            'Message Content Intentが無効です。Discord Developer PortalでONにしてください。'
          );
        } else {
          console.error('Gateway設定に致命的なエラーがあります。');
        }

        return;
      }

      if (code === 4007 || code === 4009) {
        this.sessionId = null;
        this.resumeGatewayUrl = null;
        this.sequence = null;
      }

      this.scheduleReconnect();
    });
  }

  close() {
    this.clearTimers();

    try {
      this.socket?.close(1000, 'Shutdown');
    } catch {
      // Ignore close errors.
    }
  }
}

function createHealthServer() {
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        ok: true,
        discordReady: gatewayReady,
      }));
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

  if (typeof WebSocket !== 'function') {
    console.error('このNode.jsにはWebSocket APIがありません。Node 22.15以降を使用してください。');
    process.exitCode = 1;
    return;
  }

  const server = createHealthServer();
  const gateway = new DiscordGateway();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ HTTP server listening on 0.0.0.0:${PORT}`);
  });

  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} を受信。終了します。`);
    gateway.close();

    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  try {
    await gateway.connect();
  } catch (error) {
    console.error('Discord Gateway初期接続失敗:', error?.message || error);
    gateway.scheduleReconnect(3000);
  }
}

if (require.main === module) {
  main();
}
