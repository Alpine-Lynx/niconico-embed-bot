'use strict';

const MAX_LINKS_PER_MESSAGE = 3;
const ALLOWED_HOSTS = new Set([
  'nicovideo.jp',
  'www.nicovideo.jp',
  'sp.nicovideo.jp',
  'nico.ms',
]);
const VIDEO_ID_PATTERN = /^(?:[a-z]{2}\d+|\d+)$/i;
const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;

function stripTrailingPunctuation(value) {
  return value.replace(/[.,!?;:、。！？）》」』】〉》]+$/u, '');
}

function extractVideoId(url) {
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let videoId = null;

  if (host === 'nico.ms') {
    videoId = segments[0] === 'watch' ? segments[1] : segments[0];
  } else if (segments[0] === 'watch') {
    videoId = segments[1];
  }

  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return null;
  if (/^lv\d+$/i.test(videoId)) return null;
  return videoId;
}

function convertNiconicoUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(stripTrailingPunctuation(rawUrl));
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const videoId = extractVideoId(parsed);
  if (!videoId) return null;

  const converted = new URL(`https://www.nicovideo.gay/watch/${videoId}`);
  const from = parsed.searchParams.get('from');
  if (from && /^\d{1,6}$/.test(from)) converted.searchParams.set('from', from);
  return converted.toString();
}

function convertedLinksFromMessage(content) {
  const matches = String(content || '').match(URL_PATTERN) || [];
  const output = [];
  const seen = new Set();

  for (const match of matches) {
    const converted = convertNiconicoUrl(match);
    if (!converted || seen.has(converted)) continue;
    seen.add(converted);
    output.push(converted);
    if (output.length >= MAX_LINKS_PER_MESSAGE) break;
  }

  return output;
}

module.exports = {
  convertNiconicoUrl,
  convertedLinksFromMessage,
  extractVideoId,
  stripTrailingPunctuation,
};
