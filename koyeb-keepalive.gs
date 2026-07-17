function keepBotsAwake() {
  const urls = [
    'https://weather-bot-v2.onrender.com/health',
    'https://YOUR-KOYEB-APP.koyeb.app/health'
  ];

  urls.forEach(function(url) {
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'GoogleAppsScript-Bot-KeepAlive/1.0'
        }
      });

      console.log(
        '✅ Bot wake up:',
        url,
        'HTTP',
        response.getResponseCode()
      );
    } catch (error) {
      console.error('❌ Bot wake up failed:', url, error);
    }
  });
}

// 既存トリガーが keepBotAwake を呼んでいる場合、そのまま使える。
function keepBotAwake() {
  keepBotsAwake();
}

// 手動テスト用
function testKeepAwake() {
  keepBotsAwake();
}
