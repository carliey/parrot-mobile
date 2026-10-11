// Literal requires let Metro bundle the recordings for offline playback.
const clips: Record<string, number> = {
  sannu: require('../audio/sannu.m4a'),
  yauwa: require('../audio/Yauwa.m4a'),
  inakwana: require('../audio/Ina_kwana.m4a'),
  barkadasafiya: require('../audio/Barka_da_safiya.m4a'),
  inayini: require('../audio/Ina_yini.m4a'),
  anyinilafiya: require('../audio/An_yini_lafiya.m4a'),
  yakake: require('../audio/ya_kake.m4a'),
  yakike: require('../audio/ya_kike.m4a'),
  lafiya: require('../audio/lafiya.m4a'),
  lafiyalau: require('../audio/lafiya_lau.m4a'),
  madallah: require('../audio/madallah.m4a'),
  yasunanka: require('../audio/ya_sunanka.m4a'),
  yasunanki: require('../audio/ya_sunanki.m4a'),
  sunanaaku: require('../audio/sunana_aku.m4a'),
  kaifa: require('../audio/kai_fa.m4a'),
  kefa: require('../audio/Ke_fa.m4a'),
  nagode: require('../audio/na_gode.m4a'),
  nawanewannan: require('../audio/nawa_ne_wannan.m4a'),
  abani: require('../audio/a_bani.m4a'),
  toh: require('../audio/Toh.m4a'),
};
export function audioFor(phrase: string): number | undefined {
  return clips[phrase.toLowerCase().replace(/[^a-z]/g, '')];
}
