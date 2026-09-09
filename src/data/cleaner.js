/**
 * Normalizes customer support tweet text while preserving meaning.
 */
export function unescapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function cleanTweetText(rawText) {
  if (!rawText) return '';

  let text = unescapeHtml(rawText);

  // Strip iOS 11.1 unicode question mark / variation selector artifacts
  text = text.replace(/[\uFE0F\u200D\uFFFD]/g, '');

  // Extract URLs
  const urlRegex = /https?:\/\/t\.co\/[A-Za-z0-9]+/g;
  text = text.replace(urlRegex, ' ').trim();

  // Strip @mentions (both @AppleSupport and anonymized @123456 handles)
  text = text.replace(/@\w+/g, ' ').trim();

  // Normalize multiple spaces, tabs, newlines
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export function extractEntities(rawText) {
  const text = unescapeHtml(rawText || '');
  const mentions = (text.match(/@\w+/g) || []).map(m => m.trim());
  const urls = (text.match(/https?:\/\/t\.co\/[A-Za-z0-9]+/g) || []).map(u => u.trim());

  return {
    mentions,
    urls,
    hasUrl: urls.length > 0,
    hasMultipleMentions: mentions.length > 1
  };
}
