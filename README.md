# ニコニコ動画 Discord埋め込みBot

Discordに投稿されたニコニコ動画URLを検出し、`nicovideo.gay` のURLへ変換して返信します。
Discordが返信URLを展開することで、対応環境では動画プレイヤー付き埋め込みとして表示されます。

## 対応URL

- `https://www.nicovideo.jp/watch/sm9`
- `https://sp.nicovideo.jp/watch/sm9`
- `https://nico.ms/sm9`
- `sm`、`so`、`nm`などの動画IDと数値ID
- `?from=50` の再生開始位置

生放送の `lv` URLは対象外です。

## 動作

元の投稿:

```text
https://www.nicovideo.jp/watch/sm9
```

Botの返信:

```text
https://www.nicovideo.gay/watch/sm9
```

Botは動画を取得・保存・再配信しません。URLの文字列だけを変換します。
埋め込み再生の可否はDiscordとnicovideo.gayの現在の仕様に依存します。

## Discord Developer Portal

### 1. Bot Token

`Bot` 画面でTokenを発行します。TokenはGitHubやチャットへ貼らず、Renderの環境変数へ直接設定してください。
漏れたTokenは `Reset Token` で無効化します。

### 2. Message Content Intent

`Bot → Privileged Gateway Intents` で、次をONにします。

- **Message Content Intent**

この設定がOFFだと、Botは投稿されたURL本文を読めません。

### 3. 招待権限

OAuth2 / InstallationでBotを招待します。

必要な権限:

- View Channels
- Send Messages
- Embed Links
- Read Message History

スラッシュコマンドは使わないため、`applications.commands` は必須ではありません。

## Render

新しいWeb Serviceを作り、このリポジトリを接続します。

- Build Command: `npm install --no-audit --no-fund`
- Start Command: `npm start`
- Health Check Path: `/health`

Environmentへ次を追加します。

```text
KEY: DISCORD_TOKEN
VALUE: Discord Developer Portalで発行したBot Token
```

保存して再デプロイします。

成功時のログ:

```text
✅ HTTP server listening on 0.0.0.0:10000
✅ Bot名 がオンラインになりました。
```

## セキュリティ

- Bot Tokenは環境変数のみ
- 任意URLへのHTTPアクセスなし
- 許可したニコニコドメインだけを変換
- 追跡用クエリを削除し、数字の `from` だけ保持
- 1投稿につき最大3動画
- ユーザー単位の連投制限
- Bot・Webhook投稿を無視してループ防止
- メンションを無効化
- ヘルスチェックではBot名や設定値を公開しない

## 注意

`nicovideo.gay` はニコニコ公式ではない第三者サービスです。サービス停止や仕様変更時には埋め込みが動かなくなる可能性があります。

## Google Apps Scriptで定期的に起動する

Renderの無料Web Serviceは、受信トラフィックが15分ないと休止します。
同梱の `gas-keepalive.gs` は、Renderの `/health` を10分ごとに呼び出します。

### 1. RenderのURLを確認

Renderのサービス画面に表示されるURLを確認します。

例:

```text
https://niconico-discord-embed-bot.onrender.com
```

ブラウザで次を開き、`{"ok":true}` または `{"ok":false}` が返れば利用できます。

```text
https://niconico-discord-embed-bot.onrender.com/health
```

### 2. Apps Scriptを作成

1. Google Apps Scriptで新しいプロジェクトを作成
2. エディタの既存コードを削除
3. `gas-keepalive.gs` の内容を貼り付け
4. 次の行を自分のRender URLへ変更

```javascript
const RENDER_HEALTH_URL =
  'https://niconico-discord-embed-bot.onrender.com/health';
```

### 3. トリガーを作成

関数選択欄から `setupKeepAlive` を選択して、一度だけ実行します。

初回はGoogleの権限確認が表示されます。許可すると、
`wakeRender` を10分ごとに実行する時間主導トリガーが作成されます。

トリガーを止める場合は、`removeKeepAliveTriggers` を実行します。

### 4. 動作確認

`wakeRender` を手動実行し、実行ログを確認します。

```text
Render ping: HTTP 200
{"ok":true}
```

起動直後はDiscord接続準備中のため、HTTP 503と `{"ok":false}` が
返ることがあります。リクエスト自体はRenderへ届いているため、
その場合もサービスの起動は始まっています。

### 無料枠の注意

常時起動させると、1サービスで月およそ720〜744時間を使用します。
Render無料枠はワークスペース全体で月750時間なので、
同じワークスペースで複数の無料サービスを常時起動すると
上限へ達する可能性があります。
