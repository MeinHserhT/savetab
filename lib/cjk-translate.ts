/**
 * CJK (Chinese, Japanese, Korean & regional dialects) detection and normalization
 * utilities for TabFlow tab titles.
 */

// Matches:
// - Hangul Jamo (\u1100-\u11FF, \u3130-\u318F, \uA960-\uA97F, \uD7B0-\uD7FF)
// - Hangul Syllables (\uAC00-\uD7AF)
// - Hiragana (\u3040-\u309F) & Katakana (\u30A0-\u30FF, \u31F0-\u31FF, \uFF66-\uFF9F)
// - CJK Radicals / Ideographs / Extensions / Compatibility (\u2E80-\u2EFF, \u3400-\u4DBF, \u4E00-\u9FFF, \uF900-\uFAFF)
// - Supplementary CJK Ideographs & Cantonese/Dialect Extension planes (\u{20000}-\u{2FA1F})
const CJK_CHAR_REGEX =
  /[\u1100-\u11ff\u2e80-\u2eff\u3040-\u309f\u30a0-\u30ff\u3130-\u318f\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\uf900-\ufaff\uff66-\uff9f]|[\u{20000}-\u{2fa1f}]/u;

const HANGUL_REGEX = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff]/u;
const KANA_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff\uff66-\uff9f]/u;
const HAN_REGEX =
  /[\u2e80-\u2eff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2fa1f}]/u;

export type CJKScriptKind = 'korean' | 'japanese' | 'chinese';

/**
 * Returns true if the input string contains any Chinese (Simplified, Traditional,
 * Cantonese/Hokkien/regional dialect Hanzi), Japanese (Hiragana, Katakana, Kanji),
 * or Korean (Hangul) characters.
 */
export function containsCJK(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  return CJK_CHAR_REGEX.test(text);
}

/**
 * Identifies the primary CJK script family present in a string.
 */
export function detectCJKScriptKind(
  text: string | null | undefined
): CJKScriptKind | null {
  if (!text || !containsCJK(text)) return null;
  if (HANGUL_REGEX.test(text)) return 'korean';
  if (KANA_REGEX.test(text)) return 'japanese';
  if (HAN_REGEX.test(text)) return 'chinese';
  return 'chinese';
}

/**
 * Common regional dialect expressions (Cantonese, Hokkien/Taiwanese, Sichuanese,
 * Kansai-ben Japanese, Busan/Gyeongsang Korean) mapped to standard forms to aid
 * fallback translation engines when translating dialectal tab titles.
 */
const DIALECT_NORMALIZATION_RULES: Array<[RegExp, string]> = [
  // Cantonese multi-char phrases first
  [/點解/g, '为什么'],
  [/邊個/g, '谁'],
  [/邊度/g, '哪里'],
  [/幾時/g, '什么时候'],
  [/乜嘢/g, '什么'],
  [/咩嘢/g, '什么'],
  [/唔係/g, '不是'],
  [/唔好/g, '不要'],
  [/唔識/g, '不会'],
  [/唔知/g, '不知道'],
  [/冇嘢/g, '没事'],
  [/返工/g, '上班'],
  [/收工/g, '下班'],
  [/放工/g, '下班'],
  [/食飯/g, '吃饭'],
  [/飲茶/g, '喝茶'],
  [/傾偈/g, '聊天'],
  [/拍拖/g, '谈恋爱'],
  [/犀利/g, '厉害'],
  [/好靚/g, '很漂亮'],
  [/好正/g, '太棒了'],
  // Cantonese single-char particles & verbs
  [/嘅/g, '的'],
  [/係/g, '是'],
  [/唔/g, '不'],
  [/冇/g, '没有'],
  [/喺/g, '在'],
  [/畀/g, '给'],
  [/佢哋/g, '他们'],
  [/我哋/g, '我们'],
  [/你哋/g, '你们'],
  [/佢/g, '他'],
  [/睇/g, '看'],
  [/搵/g, '找'],
  [/諗/g, '想'],
  [/講/g, '说'],
  [/聽日/g, '明天'],
  [/琴日/g, '昨天'],
  [/尋日/g, '昨天'],
  [/而家/g, '现在'],
  [/依家/g, '现在'],
  [/咁樣/g, '这样'],
  [/咗/g, '了'],
  [/咩/g, '什么'],
  // Hokkien / Taiwanese phrases
  [/啥物/g, '什么'],
  [/毋是/g, '不是'],
  [/毋知/g, '不知道'],
  [/足水/g, '很美'],
  [/歹勢/g, '不好意思'],
  [/古錐/g, '可爱'],
  // Japanese Kansai / dialectal phrases
  [/なんでやねん/g, 'なぜだ'],
  [/ほんまに/g, '本当に'],
  [/ほんま/g, '本当'],
  [/めっちゃ/g, 'とても'],
  [/あかん/g, 'だめ'],
  [/おおきに/g, 'ありがとう'],
  [/しんどい/g, '疲れた'],
  // Korean regional dialect phrases
  [/뭐하노/g, '뭐하니'],
  [/어디가노/g, '어디가니'],
  [/억수로/g, '매우'],
  [/단디/g, '제대로'],
  [/아이가/g, '아니니'],
];

export function normalizeCJKDialectPhrases(text: string): string {
  if (!text) return text;
  let normalized = text;
  for (const [pattern, replacement] of DIALECT_NORMALIZATION_RULES) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

/**
 * Cleans and clamps a translated title so it is safe for UI display and Firestore rules (1..300 chars).
 */
export function sanitizeTranslatedTitle(
  translated: string | null | undefined,
  fallbackOriginal: string
): string {
  const cleaned = (translated ?? '')
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return fallbackOriginal.trim().slice(0, 300) || 'Untitled Tab';
  }
  return cleaned.slice(0, 300);
}
