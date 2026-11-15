// 日本語・英語の切り替え
// 言語は「設定」で選んだもの（端末に保存）、なければ端末の言語（日本語以外は英語）。
// 画面の文言は T（下の JA / EN）から取る。山・構造物・展望台の名前は localizeData() で英語にする。

const LANG_KEY = 'hinode.lang';
export const LANG_PREF = (() => { try { return localStorage.getItem(LANG_KEY) || 'auto'; } catch { return 'auto'; } })();
export const LANG = LANG_PREF === 'ja' || LANG_PREF === 'en'
  ? LANG_PREF
  : (/^ja\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || 'ja') ? 'ja' : 'en');
export const EN = LANG === 'en';
export function setLangPref(v) {
  try { if (v === 'auto') localStorage.removeItem(LANG_KEY); else localStorage.setItem(LANG_KEY, v); } catch { /* 保存できない環境 */ }
}

const pad2 = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------- 文言 ----------------
const JA = {
  appName: '日の出・月の出シミュレーター',
  dirs: ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'],
  wd: ['日', '月', '火', '水', '木', '金', '土'],
  classLabel: { 100: '日本百名山', 200: '日本二百名山', 300: '日本三百名山' },
  error: (m) => `エラー: ${m}`,
  workerFail: '読み込みに失敗しました',
  hourLabel: (h) => `${h}時`,
  heightLabel: (g, t) => `<span class="h-ground">地上${g}m</span><span class="h-total">標高${t}m</span>`,
  ev: { sun: { rise: '日の出', set: '日の入り' }, moon: { rise: '月の出', set: '月の入り' } },
  transit: { sun: '南中', moon: '月の南中' },
  selectedPlace: '選択地点',
  currentPlace: '現在地',
  sharedPlace: '共有された地点',
  date: (p, wd) => `${p.y}年${p.m}月${p.d}日（${wd}）`,
  hidden: '（地形に隠れている）',
  onRidge: '（稜線にかかる）',
  sunInfo: (dir, az, alt, v) => `太陽 ${dir} ${az}°・高度 ${alt}°${v}`,
  moonInfo: (age, name, illum, dir, az, alt, v) => `月齢 ${age} ${name}・輝面 ${illum}%\n月 ${dir} ${az}°・高度 ${alt}°${v}`,
  diamond: 'ダイヤモンド', pearl: 'パール',
  aside: (peak, right, rise) => `${peak}の${right ? '右' : '左'}${rise ? 'から' : 'へ'}`,
  calcEvents: '出没を計算中…',
  altitude: (a) => `高度${a}°`,
  notVisible: '地形で見えない',
  cal: (t) => `暦 ${t}`,
  calSame: '暦と同じ',
  calDiff: (t, d) => `暦 ${t}（${d > 0 ? '+' : ''}${d}分）`,
  noEvents: 'この日は出没がありません',
  sun: '太陽', moon: '月',
  tapBody: (b, dir, az, alt) => `${b}：${dir} ${az}°・高度 ${alt}°`,
  tapPeak: (p, dir, az, dist) => `${p.name}（${p.yomi}）標高${p.elev}m・${dir} ${az}°・${dist}\nトップの「ダイヤモンド・パール予報」で、太陽・月が山頂に重なる日を探せます`,
  monthTitle: (y, m) => `${y}年${m}月`,
  calculating: '計算中…',
  hid: '隠',
  tableHead: '<th>日</th><th>日の出</th><th>日の入</th><th>月の出</th><th>月の入</th><th>月齢<small>正午</small></th>',
  peakOption: (p, dir, az, dist) => `${p.name}（${p.elev}m・${dir} ${az}°・${dist}）`,
  noPeaks: 'ここから見える山がありません',
  alignNote: (reward) => `ここから見える山の山頂に、太陽（ダイヤモンド）や月（パール）が重なる日時を、選んだ日から${reward ? '2か月分（広告を見ると1年分）' : '1年分'}探します。タップするとその瞬間へ移動します。`,
  span: (days) => (days >= 365 ? '1年分' : `${Math.round(days / 30.4)}か月分`),
  spanCalc: (s) => `${s}を計算中…`,
  center: '◎ 山頂のほぼ真上', above: '○ 少し上を通る', below: '○ 少し下（山頂にかかる）',
  newMoonNote: '・新月前後で見えない', brightSky: '・明るい空',
  alignDate: (pp, wd, time) => `${pp.y}/${pp.m}/${pp.d}（${wd}）<b>${time}</b>`,
  alignKind: (kind, peak, rising) => `${kind}${peak}・${rising ? '昇る' : '沈む'}`,
  moonAgeShort: (a) => `・月齢${a}`,
  alignNone: (s, year) => `${s}の間に山頂に重なる日はありません${year ? '（太陽・月が通らない方角です）' : ''}`,
  adUnavailable: 'いまは広告を読み込めませんでした。しばらくしてからお試しください',
  bgmOn: '♪ BGM', bgmOff: '♪ オフ',
  shareText: (place, p, time) => `${place}の${p.m}月${p.d}日 ${time} の空 #日の出月の出シミュレーター`,
  shareDialog: '共有',
  urlCopied: 'この画面のURLをコピーしました',
  followOff: 'コンパス追従をオフにしました',
  noCompass: 'この端末ではコンパス（方位センサー）が使えません',
  followOn: 'コンパス追従：端末を向けた方角を表示します',
  preparing: '準備中…',
  loadingTerrain: (n) => `${n ? n + ' の' : ''}地形データを読み込み中…`,
  calcPeaks: '見える山を計算中…',
  calcHorizon: '地平線（山の稜線）を計算中…',
  calcRise: '日の出・月の出を計算中…',
  noteSummit: (n, e) => `${n} 山頂（標高${e}m）から見ています`,
  noteDeck: (n, d) => `${n}（地上${d}m）から見ています`,
  noteUrban: '市街地のため、ビルの屋上（地上30m）から見ています。▼で地上に降りられます',
  noteCompass: '端末が向いている方角から表示しています。「コンパス」で向きに追従します',
  noteNoCompass: 'コンパスが使えないため、太陽・月の方角から表示しています',
  noteSlider: '下のスライダーで時刻、▶で分刻みに再生できます',
  loadFailed: (m) => `読み込みに失敗しました: ${m}`,
  noGeo: '位置情報が使えません',
  outsideJapan: '現在地が日本国外のため、地点を選んでください',
  noPosition: '現在地を取得できませんでした。地点を選んでください',
  noPositionShort: '現在地を取得できませんでした',
  sharedStart: (n) => `共有された地点で見る（${n}）`,
  pickAlign: '予報を出す地点（見る場所）を地図で選んでください',
  pickTap: '地図をタップして地点を選択',
  pickDeck: (n, d) => `${n}（地上${d}m）`,
  pickSummit: ' 山頂',
  gsiTiles: '地理院タイル',
  deckPrompt: '展望台から見る…',
  deckOption: (n, d) => `${n}（${d}m）`,
  peakTooltip: (m, cls) => `${m.name} ${m.elev}m${cls ? '（' + cls + '）' : ''}`,
  peakListOpt: (m) => `${m.yomi} ${m.elev}m`,
  uniqueName: (n, pref) => `${n}（${pref}）`,
  labelBig: (n, d) => `${n}（${d}）`,
};

const EN_T = {
  appName: 'Sunrise & Moonrise Simulator',
  dirs: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  classLabel: { 100: '100 Famous Mountains', 200: '200 Famous Mountains', 300: '300 Famous Mountains' },
  error: (m) => `Error: ${m}`,
  workerFail: 'failed to load',
  hourLabel: (h) => `${h}:00`,
  heightLabel: (g, t) => `<span class="h-ground">${g} m up</span><span class="h-total">Alt. ${t} m</span>`,
  ev: { sun: { rise: 'Sunrise', set: 'Sunset' }, moon: { rise: 'Moonrise', set: 'Moonset' } },
  transit: { sun: 'Solar noon', moon: 'Moon transit' },
  selectedPlace: 'Selected point',
  currentPlace: 'Current location',
  sharedPlace: 'Shared point',
  date: (p, wd) => `${wd}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`,
  hidden: ' (behind terrain)',
  onRidge: ' (on the ridge)',
  sunInfo: (dir, az, alt, v) => `Sun ${dir} ${az}° · alt ${alt}°${v}`,
  moonInfo: (age, name, illum, dir, az, alt, v) => `Moon age ${age} ${name} · ${illum}% lit\nMoon ${dir} ${az}° · alt ${alt}°${v}`,
  diamond: 'Diamond', pearl: 'Pearl',
  aside: (peak, right, rise) => `${rise ? 'from' : 'to'} the ${right ? 'right' : 'left'} of ${peak}`,
  calcEvents: 'Calculating rise and set times…',
  altitude: (a) => `alt ${a}°`,
  notVisible: 'Hidden by terrain',
  cal: (t) => `Std ${t}`,
  calSame: 'Same as std',
  calDiff: (t, d) => `Std ${t} (${d > 0 ? '+' : ''}${d} min)`,
  noEvents: 'No rise or set on this day',
  sun: 'Sun', moon: 'Moon',
  tapBody: (b, dir, az, alt) => `${b}: ${dir} ${az}° · alt ${alt}°`,
  tapPeak: (p, dir, az, dist) => `${p.name} · ${p.elev} m · ${dir} ${az}° · ${dist}\nUse "Diamond & Pearl Forecast" on the top page to find when the sun or moon sits on its summit`,
  monthTitle: (y, m) => `${MONTHS[m - 1]} ${y}`,
  calculating: 'Calculating…',
  hid: 'hid.',
  tableHead: '<th>Day</th><th>Sunrise</th><th>Sunset</th><th>Moonrise</th><th>Moonset</th><th>Moon age<small>noon</small></th>',
  peakOption: (p, dir, az, dist) => `${p.name} (${p.elev} m · ${dir} ${az}° · ${dist})`,
  noPeaks: 'No mountains visible from here',
  alignNote: (reward) => `Finds when the sun (Diamond) or the moon (Pearl) sits on the summit of a mountain you can see from here, for ${reward ? '2 months (1 year after watching an ad)' : '1 year'} from the selected date. Tap a result to jump to that moment.`,
  span: (days) => (days >= 365 ? '1 year' : `${Math.round(days / 30.4)} months`),
  spanCalc: (s) => `Searching ${s}…`,
  center: '◎ Right on the summit', above: '○ Passes just above', below: '○ Slightly low (touches the summit)',
  newMoonNote: ' · near new moon, not visible', brightSky: ' · bright sky',
  alignDate: (pp, wd, time) => `${wd}, ${MONTHS[pp.m - 1]} ${pp.d}, ${pp.y}<b>${time}</b>`,
  alignKind: (kind, peak, rising) => `${kind} ${peak} · ${rising ? 'rising' : 'setting'}`,
  moonAgeShort: (a) => ` · moon age ${a}`,
  alignNone: (s, year) => `The sun and moon do not touch the summit in ${s}${year ? ' (they never pass in that direction)' : ''}`,
  adUnavailable: 'The ad could not be loaded right now. Please try again later.',
  bgmOn: '♪ Music', bgmOff: '♪ Off',
  shareText: (place, p, time) => `The sky at ${place} on ${MONTHS[p.m - 1]} ${p.d}, ${time} #SunriseMoonriseSimulator`,
  shareDialog: 'Share',
  urlCopied: 'Link to this view copied',
  followOff: 'Compass follow turned off',
  noCompass: 'This device has no compass (orientation sensor)',
  followOn: 'Compass follow: the view turns with your phone',
  preparing: 'Preparing…',
  loadingTerrain: (n) => `Loading terrain${n ? ' for ' + n : ''}…`,
  calcPeaks: 'Finding visible mountains…',
  calcHorizon: 'Calculating the skyline…',
  calcRise: 'Calculating sunrise and moonrise…',
  noteSummit: (n, e) => `Viewing from the summit of ${n} (${e} m)`,
  noteDeck: (n, d) => `Viewing from ${n} (${d} m above ground)`,
  noteUrban: 'In a city area, so viewing from a rooftop (30 m). Press ▼ to go down to the ground',
  noteCompass: 'Showing the direction your phone faces. "Compass" makes the view follow it',
  noteNoCompass: 'No compass, so showing the direction of the sun or moon',
  noteSlider: 'Use the slider below to change the time, ▶ to play minute by minute',
  loadFailed: (m) => `Failed to load: ${m}`,
  noGeo: 'Location is not available',
  outsideJapan: 'Your location is outside Japan. Please choose a point on the map',
  noPosition: 'Could not get your location. Please choose a point on the map',
  noPositionShort: 'Could not get your location',
  sharedStart: (n) => `View the shared point (${n})`,
  pickAlign: 'Choose the point you will watch from on the map',
  pickTap: 'Tap the map to choose a point',
  pickDeck: (n, d) => `${n} (${d} m above ground)`,
  pickSummit: ' summit',
  gsiTiles: 'GSI Tiles',
  deckPrompt: 'View from an observation deck…',
  deckOption: (n, d) => `${n} (${d} m)`,
  peakTooltip: (m, cls) => `${m.name} ${m.elev} m${cls ? ' (' + cls + ')' : ''}`,
  peakListOpt: (m) => `${m.ja || ''} ${m.elev} m`,
  uniqueName: (n, pref) => `${n} (${pref})`,
  labelBig: (n, d) => `${n} (${d})`,
};
export const T = EN ? EN_T : JA;

// 月齢から月の呼び名（英語）
export function moonNameEn(age) {
  if (age < 1.0 || age >= 28.5) return 'New Moon';
  if (age < 6.3) return 'Waxing Crescent';
  if (age < 8.3) return 'First Quarter';
  if (age < 13.8) return 'Waxing Gibbous';
  if (age < 15.6) return 'Full Moon';
  if (age < 21.3) return 'Waning Gibbous';
  if (age < 23.3) return 'Last Quarter';
  return 'Waning Crescent';
}

// ---------------- 画面の固定の文言（英語のときだけ書き換える） ----------------
const STATIC_EN = [
  ['title', 'text', 'Sunrise & Moonrise Simulator'],
  ['#compass', 'title', 'Direction'],
  ['#btn-home', 'html', '⌂ Top'], ['#btn-home', 'aria-label', 'Back to the top page'],
  ['#btn-up', 'aria-label', 'Up'], ['#btn-down', 'aria-label', 'Down'],
  ['#btn-play', 'aria-label', 'Play'], ['#time-slider', 'aria-label', 'Time'],
  ['#btn-dprev', 'aria-label', 'Previous day'], ['#date', 'aria-label', 'Date'], ['#btn-dnext', 'aria-label', 'Next day'],
  ['#btn-now', 'text', 'Now'], ['#btn-labels', 'text', 'Names'], ['#btn-table', 'text', 'Month'],
  ['#btn-follow', 'text', 'Compass'], ['#btn-follow', 'title', 'The view turns with your phone'],
  ['#btn-share', 'text', 'Share'],
  ['#btn-mprev', 'aria-label', 'Previous month'], ['#btn-mnext', 'aria-label', 'Next month'],
  ['#btn-table-close', 'aria-label', 'Close'], ['#btn-align-close', 'aria-label', 'Close'],
  ['#table-modal .modal-note', 'text', 'Top: times with terrain (when it appears from or hides behind the ridge). Small numbers: standard times for a flat sea-level horizon. Tap a row to go to that day.'],
  ['#align-modal .modal-title', 'text', 'Diamond & Pearl Forecast'],
  ['#align-peak', 'aria-label', 'Choose a mountain'], ['#btn-align-run', 'text', 'Search'],
  ['#btn-align-year', 'text', '▶ Watch an ad to search 1 year'],
  ['#start h1', 'html', 'Sunrise &amp; Moonrise<br>Simulator'],
  ['#start .lead', 'html', 'See <b>when and where the sun and moon really appear over the mountains</b>, calculated from terrain and buildings, minute by minute.<br>Sunrise, sunset, moonrise, moonset, moon age, and "Diamond Fuji" / "Pearl Fuji" forecasts for Japan.'],
  ['#start .date-pick', 'first-text', 'Date '],
  ['#btn-start', 'text', 'View from here'], ['#btn-start-place', 'text', 'Choose a point'],
  ['#btn-start-align', 'text', '💎 Diamond & Pearl Forecast'],
  ['#play-link', 'text', '▶ Android app (Google Play)'],
  ['#start .note', 'html', '"View from here" starts in the direction your phone faces (for today\'s date).<br>Drag to turn and tilt, pinch (or wheel) to zoom, ▲▼ to change your eye height.'],
  ['.settings summary', 'text', 'Settings'],
  ['#opt-lang', 'label-text', 'Language'],
  ['#opt-source', 'label-text', 'Elevation data'],
  ['#opt-source option[value=gsi]', 'text', 'GSI elevation tiles'],
  ['#opt-speed', 'label-text', 'Playback speed'],
  ['#opt-speed option[value="1"]', 'text', '1 min per second'], ['#opt-speed option[value="5"]', 'text', '5 min per second'],
  ['#opt-speed option[value="20"]', 'text', '20 min per second'], ['#opt-speed option[value="60"]', 'text', '1 hour per second'],
  ['#opt-speed option[value="0.0166667"]', 'text', 'Real time'],
  ['#opt-sfx', 'label-text', 'Sound effects'], ['#opt-buildings', 'label-text', 'Buildings'],
  ['#opt-snow', 'label-text', 'Snow'],
  ['#opt-snow option[value=auto]', 'text', 'By season'], ['#opt-snow option[value="0"]', 'text', 'None'],
  ['#opt-snow option[value="2600"]', 'text', 'Summits only'], ['#opt-snow option[value="1800"]', 'text', 'Winter'],
  ['.app-foot a', 'text', 'Privacy policy'], ['.app-foot a', 'href', 'https://techgym.jp/privacy-policy-en/'],
  ['#btn-ad-privacy', 'text', 'Ad settings'],
  ['#deck-select', 'aria-label', 'View from an observation deck'],
  ['#search', 'placeholder', 'Go to a summit by name (e.g. Mt. Fuji)'],
  ['#btn-here', 'text', 'Here'], ['#btn-here', 'title', 'Current location'],
  ['#picker-info', 'text', 'Tap the map to choose a point'],
  ['#btn-picker-cancel', 'text', 'Back'], ['#btn-picker-ok', 'text', 'View from this point'],
  ['#loading-text', 'text', 'Loading terrain…'],
  ['meta[name=description]', 'content', 'A web tool that simulates sunrise, sunset, moonrise, moonset and moon age with real terrain, by date and minute.'],
];
export function applyStatic() {
  document.documentElement.lang = LANG;
  if (!EN) return;
  for (const [sel, prop, val] of STATIC_EN) {
    const el = document.querySelector(sel);
    if (!el) continue;
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else if (prop === 'first-text') { const n = [...el.childNodes].find((c) => c.nodeType === 3); if (n) n.textContent = val; }
    else if (prop === 'label-text') { const n = [...el.parentElement.childNodes].find((c) => c.nodeType === 3 && c.textContent.trim()); if (n) n.textContent = val + '\n'; }
    else el.setAttribute(prop, val);
  }
}

// ---------------- 山・構造物・展望台の英語名 ----------------
const PREF_EN = {
  北海道: 'Hokkaido', 青森県: 'Aomori', 岩手県: 'Iwate', 宮城県: 'Miyagi', 秋田県: 'Akita', 山形県: 'Yamagata', 福島県: 'Fukushima',
  茨城県: 'Ibaraki', 栃木県: 'Tochigi', 群馬県: 'Gunma', 埼玉県: 'Saitama', 千葉県: 'Chiba', 東京都: 'Tokyo', 神奈川県: 'Kanagawa',
  新潟県: 'Niigata', 富山県: 'Toyama', 石川県: 'Ishikawa', 福井県: 'Fukui', 山梨県: 'Yamanashi', 長野県: 'Nagano', 岐阜県: 'Gifu',
  静岡県: 'Shizuoka', 愛知県: 'Aichi', 三重県: 'Mie', 滋賀県: 'Shiga', 京都府: 'Kyoto', 大阪府: 'Osaka', 兵庫県: 'Hyogo', 奈良県: 'Nara',
  和歌山県: 'Wakayama', 鳥取県: 'Tottori', 島根県: 'Shimane', 岡山県: 'Okayama', 広島県: 'Hiroshima', 山口県: 'Yamaguchi',
  徳島県: 'Tokushima', 香川県: 'Kagawa', 愛媛県: 'Ehime', 高知県: 'Kochi', 福岡県: 'Fukuoka', 佐賀県: 'Saga', 長崎県: 'Nagasaki',
  熊本県: 'Kumamoto', 大分県: 'Oita', 宮崎県: 'Miyazaki', 鹿児島県: 'Kagoshima', 沖縄県: 'Okinawa',
};
const prefEn = (p) => (p || '').split('・').map((x) => PREF_EN[x] || x).join(' / ');

const STRUCT_EN = {
  東京スカイツリー: 'Tokyo Skytree', 東京タワー: 'Tokyo Tower', 麻布台ヒルズ森JPタワー: 'Azabudai Hills Mori JP Tower',
  虎ノ門ヒルズステーションタワー: 'Toranomon Hills Station Tower', 虎ノ門ヒルズ森タワー: 'Toranomon Hills Mori Tower',
  東京ミッドタウン: 'Tokyo Midtown', 東京都庁: 'Tokyo Metropolitan Government Building', NTTドコモ代々木ビル: 'NTT Docomo Yoyogi Building',
  サンシャイン60: 'Sunshine 60', 六本木ヒルズ森タワー: 'Roppongi Hills Mori Tower', 新宿パークタワー: 'Shinjuku Park Tower',
  東京オペラシティ: 'Tokyo Opera City', 新宿三井ビル: 'Shinjuku Mitsui Building', 横浜ランドマークタワー: 'Yokohama Landmark Tower',
  横浜マリンタワー: 'Yokohama Marine Tower', 千葉ポートタワー: 'Chiba Port Tower', 牛久大仏: 'Ushiku Daibutsu',
  名古屋テレビ塔: 'Nagoya TV Tower', JRセントラルタワーズ: 'JR Central Towers', ミッドランドスクエア: 'Midland Square',
  あべのハルカス: 'Abeno Harukas', 大阪府咲洲庁舎: 'Osaka Prefectural Government Sakishima Building', りんくうゲートタワービル: 'Rinku Gate Tower Building',
  中之島フェスティバルタワー: 'Nakanoshima Festival Tower', 梅田スカイビル: 'Umeda Sky Building', 通天閣: 'Tsutenkaku',
  京都タワー: 'Kyoto Tower', 福岡タワー: 'Fukuoka Tower', さっぽろテレビ塔: 'Sapporo TV Tower', JRタワー: 'JR Tower', 五稜郭タワー: 'Goryokaku Tower',
};
const DECK_EN = {
  '東京スカイツリー 天望回廊': 'Tokyo Skytree Tembo Galleria', '東京スカイツリー 天望デッキ': 'Tokyo Skytree Tembo Deck',
  '東京タワー トップデッキ': 'Tokyo Tower Top Deck', '東京タワー メインデッキ': 'Tokyo Tower Main Deck',
  'SHIBUYA SKY（渋谷スクランブルスクエア）': 'SHIBUYA SKY (Shibuya Scramble Square)', 'サンシャイン60 展望台': 'Sunshine 60 Observatory',
  '六本木ヒルズ 東京シティビュー': 'Roppongi Hills Tokyo City View', '東京都庁 展望室': 'Tokyo Metropolitan Government Observatory',
  '横浜ランドマークタワー スカイガーデン': 'Yokohama Landmark Tower Sky Garden', '横浜マリンタワー 展望フロア': 'Yokohama Marine Tower Observation Floor',
  '千葉ポートタワー 展望室': 'Chiba Port Tower Observatory', 'ミッドランドスクエア スカイプロムナード': 'Midland Square Sky Promenade',
  '中部電力 MIRAI TOWER（名古屋テレビ塔）': 'Chubu Electric Power MIRAI TOWER (Nagoya TV Tower)', 'あべのハルカス 展望台（ハルカス300）': 'Abeno Harukas Observatory (Harukas 300)',
  '大阪府咲洲庁舎 展望台': 'Sakishima Building Observatory', '梅田スカイビル 空中庭園': 'Umeda Sky Building Floating Garden',
  '通天閣 展望台': 'Tsutenkaku Observatory', '京都タワー 展望室': 'Kyoto Tower Observatory', '福岡タワー 展望室': 'Fukuoka Tower Observatory',
  'JRタワー 展望室T38': 'JR Tower Observatory T38', 'さっぽろテレビ塔 展望台': 'Sapporo TV Tower Observatory', '五稜郭タワー 展望台': 'Goryokaku Tower Observatory',
};
const AREA_EN = { 東京: 'Tokyo', '神奈川・千葉': 'Kanagawa / Chiba', 東海: 'Tokai', 関西: 'Kansai', 九州: 'Kyushu', 北海道: 'Hokkaido' };

// ひらがな（カタカナ）→ ローマ字（ヘボン式、長音は省く）
const KANA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゔ: 'vu',
};
const YOON = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
export function romaji(kana) {
  const s = (kana || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], nx = s[i + 1];
    if (c === 'っ') { const r = KANA[nx] || ''; out += r.startsWith('ch') ? 't' : r[0] || ''; continue; }
    if (c === 'ー') continue;
    let r = KANA[c];
    if (r === undefined) { out += c; continue; }
    if (YOON[nx]) {
      // きゃ → kya, しゃ → sha, ちゃ → cha, じゃ → ja
      if (r.endsWith('i') && r.length > 1) r = (r === 'shi' ? 'sh' : r === 'chi' ? 'ch' : r === 'ji' ? 'j' : r.slice(0, -1) + 'y') + YOON[nx];
      i++;
    }
    // ん + 母音・や行 は n' にしない（読みやすさ優先）
    out += r;
  }
  // 長音（ou / uu / oo）を短く
  return out.replace(/ou/g, 'o').replace(/uu/g, 'u').replace(/oo(?=[^aeiou]|$)/g, 'o');
}
const cap = (s) => s.replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// 山の英語名: 「〜さん・〜やま・〜だけ」などは Mt. を付けて取る（ふじさん → Mt. Fuji）
const SUFFIX = ['がたけ', 'がだけ', 'だけ', 'たけ', 'さん', 'ざん', 'せん', 'やま', 'ほう'];
export function mountainEn(yomi) {
  const y = (yomi || '').replace(/[\s・]/g, '');
  for (const s of SUFFIX) {
    if (y.endsWith(s) && y.length - s.length >= 2) {
      const base = romaji(y.slice(0, -s.length));
      if (base.length >= 3) return { full: `Mt. ${cap(base)}`, base: cap(base) };
    }
  }
  const r = cap(romaji(y));
  return { full: r.startsWith('Mt') ? r : `Mt. ${r}`, base: r };
}

// データの名前を、英語のときは英語に書き換える（元の名前は ja に残す）
export function localizeData(mountains, structures, observatories) {
  if (!EN) return;
  for (const m of mountains) {
    const e = mountainEn(m.yomi);
    m.ja = m.name; m.name = e.full; m.base = e.base;
    m.yomi = m.ja; // 英語表示では読みの代わりに漢字を添える
    m.pref = prefEn(m.pref);
  }
  for (const s of structures) {
    s.ja = s.name; s.name = STRUCT_EN[s.name] || cap(romaji(s.yomi)); s.yomi = s.ja;
  }
  for (const o of observatories) {
    o.ja = o.name; o.name = DECK_EN[o.name] || o.name; o.area = AREA_EN[o.area] || o.area;
  }
}
