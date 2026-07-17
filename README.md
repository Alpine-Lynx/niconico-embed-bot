# Discord動画埋め込みBot — Koyeb版 v1.2

ニコニコ動画とBilibiliのURLを、Discordで再生可能な埋め込み用URLへ変換して返信します。

## 対応例

### ニコニコ動画

```text
https://www.nicovideo.jp/watch/sm9
↓
https://www.nicovideo.gay/watch/sm9
```

### Bilibili

```text
https://www.bilibili.com/video/BV1xx411c7mD
↓
https://www.vxbilibili.com/video/BV1xx411c7mD?lang=jp
```

```text
https://b23.tv/AbCd123
↓
https://vxb23.tv/AbCd123?lang=jp
```

Bilibiliの `p` と数値の `t` パラメータは保持します。
1メッセージにつき最大3件、重複URLは除外します。

## 今回のビルドエラー修正

KoyebのBuildpackはNode.js `22.x` をサポートしています。
存在しない `22.22.0` ではなく、`package.json` を次に修正済みです。

```json
"engines": {
  "node": "22.x"
}
```

## GitHubへ上書きするファイル

このZIPを展開し、リポジトリ直下へ次のファイルをすべて上書きしてください。

- README.md
- index.js
- koyeb-keepalive.gs
- link-utils.js
- package.json
- test.js

特に `package.json` を必ず上書きしてください。

## Koyeb

Builder:

```text
Buildpack
```

Run command:

```text
npm start
```

Port:

```text
8000
```

Environment variable:

```text
DISCORD_TOKEN = Reset後の新しいBot Token
```

GitHubへコミットすると自動デプロイされます。
自動で始まらない場合はKoyebでRedeployを実行してください。

## Discord Developer Portal

Bot → Privileged Gateway Intents:

```text
Message Content Intent = ON
```

必要なBot権限:

- View Channels
- Send Messages
- Embed Links
- Read Message History

## GAS

`koyeb-keepalive.gs` のKoyeb URLを実際のURLへ変更します。

```javascript
'https://YOUR-KOYEB-APP.koyeb.app/health'
```
