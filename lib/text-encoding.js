/**
 * Repair Chinese mojibake common on Windows Cursor hooks:
 * UTF-8 bytes incorrectly decoded as GBK/CP936.
 */
let iconv = null;
try {
  iconv = require("iconv-lite");
} catch {
  iconv = null;
}

function countCjk(s) {
  return (String(s || "").match(/[\u4e00-\u9fff]/g) || []).length;
}

function weirdMojibakeHits(s) {
  // Characteristic syllables from UTF-8 bytes mis-decoded as GBK
  return (String(s || "").match(/[绻锟鎻缁幁鍚簩鏈杩欐槸缂哄皯椤灞嶈]/g) || []).length;
}

function looksLikeGbkMojibake(s) {
  const text = String(s || "");
  if (countCjk(text) < 2) return false;
  return weirdMojibakeHits(text) >= 2;
}

function repairGbkMojibake(str) {
  if (!iconv) return null;
  const text = String(str || "");
  if (!text) return null;
  try {
    const repaired = iconv.decode(iconv.encode(text, "gbk"), "utf8").replace(/\uFFFD+/g, "");
    if (!repaired || repaired === text) return null;

    const beforeWeird = weirdMojibakeHits(text);
    const afterWeird = weirdMojibakeHits(repaired);
    const punct = (repaired.match(/[，。！？、：；]/g) || []).length;

    // Mojibake markers drop and punctuation / readable CJK appear
    if (beforeWeird >= 2 && afterWeird < beforeWeird && (punct > 0 || countCjk(repaired) >= 2)) {
      return repaired;
    }
    // Short clear repairs (e.g. 绻肩簩 → 繼續)
    if (beforeWeird >= 1 && afterWeird === 0 && repaired.length <= text.length + 4) {
      return repaired;
    }
    return null;
  } catch {
    return null;
  }
}

function repairLatin1Utf8(str) {
  const text = String(str || "");
  if (!text || countCjk(text) > 0) return null;
  if (!/[ÃÂåæçðñï]/.test(text)) return null;
  try {
    const repaired = Buffer.from(text, "binary").toString("utf8");
    if (repaired.includes("\uFFFD")) return null;
    if (countCjk(repaired) > 0) return repaired;
  } catch {
    // ignore
  }
  return null;
}

function fixTextEncoding(input) {
  const text = String(input ?? "");
  if (!text) return text;

  const latin = repairLatin1Utf8(text);
  if (latin) return latin;

  const fixed = repairGbkMojibake(text);
  if (fixed) return fixed;

  return text;
}

function fixTurnText(turn) {
  if (!turn || typeof turn !== "object") return turn;
  // Do not rewrite code blocks — may contain mojibake sample literals
  if (turn.role === "code" || turn.role === "edit") return turn;
  const next = { ...turn };
  if (typeof next.text === "string") next.text = fixTextEncoding(next.text);
  if (typeof next.path === "string") next.path = fixTextEncoding(next.path);
  if (typeof next.title === "string") next.title = fixTextEncoding(next.title);
  return next;
}

module.exports = {
  fixTextEncoding,
  fixTurnText,
  looksLikeGbkMojibake,
  countCjk
};
