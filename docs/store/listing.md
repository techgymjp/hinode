# Google Play ストアの掲載情報（ASO を意識した版）

- アプリの種類：**アプリ**（ゲームではない）／ 無料 ／ 広告：含む
- カテゴリ（おすすめ）：**天気**（日の出・日の入りアプリが多く、検索で並びやすい）。次点は「旅行＆地域」
- 画像：`docs/store/` の `icon-512.png`、`feature-graphic-ja.png` / `feature-graphic-en.png`、スクリーンショット `ja-1〜6` / `en-1〜6`（1080×1920、この順に並べる。最初の 2〜3 枚が検索結果に出るので、ダイヤモンド富士・パール富士を先頭に）

## ASO の考え方

- 検索されやすい語（日の出／日の入り／月の出／月の入り／月齢／ダイヤモンド富士／パール富士／初日の出／ご来光／時刻／方角）を、アプリ名・簡単な説明・説明の最初の数行に入れる
- Google Play はアプリ名と簡単な説明を特に重く見る。説明文は同じ語を不自然にくり返さず、文章として自然に入れる（詰め込みは審査で減点・却下の対象）
- 英語版は「sunrise sunset」「moonrise」「moon phase」「Diamond Fuji」「Mt. Fuji」「Japan」を入れる

---

## 日本語（ja-JP）

### アプリ名（30 字以内）

日の出・月の出シミュレーター｜月齢・ダイヤモンド富士

### 簡単な説明（80 字以内）

日の出・日の入り・月の出・月の入りの時刻と方角を、山の地形から分刻みで計算。月齢、ダイヤモンド富士・パール富士の予報も

### 詳しい説明（4000 字以内）

山や建物にさえぎられる「本当の」日の出・日の入り、月の出・月の入りの時刻と方角を、国土地理院の地形データから計算して、景色の中に再現するアプリです。
ダイヤモンド富士・パール富士の予報、初日の出やご来光、夕日・月の撮影の計画に使えます。

■ 地形を考慮した日の出・月の出の時刻
暦の日の出時刻は「海抜0mの平らな地平線」で計算されています。山に囲まれた場所では、太陽が稜線から顔を出すのはそれより何十分も遅くなります。
このアプリは、見ている場所から360°の山の稜線を計算し、太陽や月が実際に稜線から出る・稜線に沈む時刻を求めます。暦の時刻と並べて「暦より31分遅い」のように比べられます。

■ 分刻みのシミュレーション
時刻のスライダーと再生ボタンで、太陽と月の動きを分刻みで再現。空の色（昼・夕焼け・薄明・夜）、星の動き、月の満ち欠けも時刻とともに変わり、太陽や月は山の陰に隠れます。

■ ダイヤモンド富士・パール富士の予報
ここから見える山を選ぶと、太陽（ダイヤモンド）や月（パール）が山頂に重なる日時を探します。富士山だけでなく、見えている山ならどの山でも予報できます。

■ 月齢・月の形
月齢、月の呼び名（三日月・上弦の月・十三夜・満月・十六夜・下弦の月など）、輝面比、月の明るい側の向きを表示します。

■ 1か月の一覧表
日の出・日の入り・月の出・月の入り（地形を考慮した時刻と暦の時刻）と正午の月齢を1か月分まとめて表示します。

■ 場所の選び方
・現在地（GPS）：スマホを向けた方角の景色から始まり、コンパスに合わせて景色がついてきます
・地図をタップ、山の名前で山頂へ（約1,000座）
・東京スカイツリー、あべのハルカスなど全国の展望台
・視点の高さを地上1.6m〜5000mで変えられます

■ こんなときに
・初日の出、山頂のご来光を見に行く場所と時刻を決めたい
・山の向こうから昇る満月を撮影したい
・ダイヤモンド富士・パール富士の撮影計画を立てたい
・谷あいの家で、冬は何時に日が差すのか知りたい

■ データについて
・地形：国土地理院の標高タイル・空中写真（地理院タイル）
・山の名前と標高：国土地理院「日本の主な山岳標高」
・太陽と月の位置は天文計算で求めています（暦の時刻は国立天文台の暦と同じ定義）
・地形の表示にはインターネット接続が必要です
・日本国内の地点に対応しています

日本語と英語に対応しています。

---

## English (en-US)

### App name (30)

Sunrise & Moonrise Simulator

### Short description (80)

Real sunrise, sunset, moonrise and moonset over the mountains. Diamond Fuji too

### Full description (4000)

See when the sun and moon really appear over the mountains. This app calculates sunrise, sunset, moonrise and moonset times and directions from real terrain data of Japan, and shows them in a 3D view of the landscape.
Plan your trip to see the first sunrise of the year, a mountain-top sunrise, or the famous "Diamond Fuji" and "Pearl Fuji".

■ Sunrise and moonrise with real terrain
Standard sunrise times assume a flat, sea-level horizon. Surrounded by mountains, the sun can appear tens of minutes later.
This app works out the 360° skyline around you and finds when the sun or moon actually clears the ridge or sets behind it, side by side with the standard time.

■ Minute-by-minute simulation
Drag the time slider or press play to move the sun and moon minute by minute. The sky colour, the stars and the moon phase change with time, and the sun and moon hide behind the mountains.

■ Diamond Fuji & Pearl Fuji forecast
Pick any mountain you can see and find when the sun (Diamond) or the moon (Pearl) sits on its summit.

■ Moon age and phase
Moon age, phase name (Waxing Crescent, First Quarter, Full Moon, …), illumination and the direction of the lit side.

■ Monthly table
Sunrise, sunset, moonrise and moonset for a whole month, with terrain-aware and standard times, plus the moon age at noon.

■ Choose your place
- Current location (GPS): starts from the direction your phone faces and can follow the compass
- Tap the map, or jump to a summit by name (about 1,000 mountains)
- Observation decks such as Tokyo Skytree and Abeno Harukas
- Change your eye height from 1.6 m to 5000 m

■ Data
- Terrain: GSI Tiles (Geospatial Information Authority of Japan)
- Sun and moon positions: astronomical calculation
- An internet connection is needed to load the terrain
- Locations in Japan only

Available in Japanese and English.
