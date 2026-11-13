# 日の出・月の出シミュレーター

Web 版: https://techgymjp.github.io/hinode/ ／ Android アプリ（動作確認用 APK）: 下の「Android アプリ」

山や建物の地形を考慮して、**太陽や月が実際に稜線から顔を出す・沈む時刻と方角**を、日付と分刻みの時刻でシミュレーションするWebツールです。
[山探し（techgymjp/yama）](https://github.com/techgymjp/yama) の景色描画システム（国土地理院の標高タイル・空中写真による360°の景色）を使っています。

## できること

- **日付を指定**して、その日の 日の出・日の入り・月の出・月の入り・南中 を表示
  - 地形を考慮した時刻（山の稜線から出る・隠れる時刻）と、暦の時刻（海抜0mの平らな地平線、国立天文台の暦と同じ定義）を並べて表示し、差（「暦 06:35（+31分）」など）も表示
  - 地形に隠れて一日中見えない場合は「地形で見えない」と表示
  - 出没の方角にある山の名前（「富士山の右から」など）、山頂から出る・沈むときは「ダイヤモンド富士」「パール○○」
- **分刻みのシミュレーション**: スライダー・±1分ボタン・▶再生（1分/秒〜1時間/秒、実時間）で時刻を動かすと、
  空の色（昼・夕焼け・薄明・夜）、太陽、月（満ち欠けと明るい側の向きつき）、星の日周運動、地形の明るさが変わります。太陽・月は山の陰に隠れます
- **月齢・月の形**: 月齢、月の呼び名（三日月・上弦・十三夜・十六夜…）、輝面比
- **月間表**: 1か月分の出没時刻（地形／暦）と正午月齢。行をタップでその日へ
- **ダイヤモンド・パール予報**（トップページから。地点を選ぶとその場所の予報画面が開く）: ここから見える山を選ぶと、太陽・月が山頂に重なる日時を1年分探します
- 現在地（GPS）・地図・山の名前・展望台（地図画面の上の選択欄）から地点を選べ、▲▼で視点の高さ（地上1.6m〜5000m）を変えられます
- 「共有」で地点・日時・向きを含むURLを共有できます
- BGM（夜明けの空をイメージしたオリジナルのアンビエント曲。太陽の高さで明るさが変わる）とボタンの効果音。どちらも Web Audio でその場で合成（音源ファイルなし）

## 計算方法

- `src/astro.js`: 太陽（天文年鑑の簡易式、誤差 約0.01°）と月（Meeus『Astronomical Algorithms』47章の主要項、地心→測心の視差補正）の位置、大気差（Sæmundsson の式）、月齢（直前の朔からの経過日数）、輝面比
  - 東京の 2024/1/1・夏至の暦の日の出・日の入り・南中が国立天文台の値と1分以内で一致することを確認
- `src/events.js`: 出没・南中・山頂との重なりの探索（4分刻みで符号の変化を探し、二分法で1秒まで詰める）
  - 地形を考慮した出没 = 天体の上辺（見かけの高度＋視半径）が、その方位の地形の見かけの高度と等しくなる時刻
- `src/worker.js`（Web Worker）: 山探しの景色描画に加えて、0.1°刻み360°の「地形の地平線」（各方位で見える地形の最大仰角。地球の丸みと大気差 k=0.13 を考慮）を計算。出没の瞬間はその方位で計算し直して精度を上げています
- 地形の空は透明で描画し、空・星・太陽・月はメインスレッドで時刻に応じて描いて、地形の後ろに重ねています

## 開発・公開

Web 版はビルド不要です。リポジトリのルートをそのまま静的サーバで配信すれば動きます（ES モジュール・モジュール Worker を使うため、ファイルを直接開くのではなくサーバ経由で）。

```bash
python3 -m http.server 8000   # http://localhost:8000/ を開く
```

GitHub Pages は「Deploy from a branch: main / (root)」で公開しています（`main` に push すると反映）。
Leaflet は `vendor/leaflet/` に同梱しています。位置情報とコンパスは HTTPS（または localhost）でのみ動作します。

## Android アプリ

[Capacitor](https://capacitorjs.com/) 8 で Web 版をそのままアプリに同梱しています（縦画面固定、パッケージ名 `jp.techgym.hinode`）。
構成は techgymjp/jet-fighter の `docs/ANDROID_PORTING.md` と同じです。

- 動作確認用 APK（テスト広告・デバッグ署名）：リリース画面 https://github.com/techgymjp/hinode/releases/tag/android-latest
  - APK 直接：https://github.com/techgymjp/hinode/releases/latest/download/hinode.apk
  - スマホで読み取る QR コード（リリース画面）：

    ![APK のリリース画面](docs/apk-qr.png)

- `main` に push すると GitHub Actions（`.github/workflows/android.yml`）が APK をビルドし、Release `android-latest` の APK を差し替えます
- GitHub Secrets（`ANDROID_KEYSTORE_BASE64` ほか 4 つ）を登録すると、本番広告の署名付き AAB（Google Play 用）も Artifacts `hinode-release-aab` に作られます
- `npm run build:app`：`index.html` `src/` `vendor/` を `www/` にまとめ、Web 版だけの部分（`// web-only:start` 〜 `// web-only:end` などで囲んだデバッグ用コード）を取り除く
- `npm run android:sync`：`www/` を Android プロジェクトへコピー（Android Studio で開くときは `npm run android:open`）
- アイコン・起動画面は `assets/` の画像から `npx @capacitor/assets generate --android` で生成

### アプリだけの動き

- 戻るボタン：月間表・ダイヤモンド予報・地図を閉じる → 景色からはトップへ → トップではアプリを終了
- 別のアプリに切り替えたら、時刻の再生・コンパス追従・音を止める
- 共有：Android の共有メニューで、Web 版の URL（地点・日時・向き入り）を送る
- スタート画面にバージョン（ビルド番号）とプライバシーポリシー、EU など同意が必要な地域では「広告の設定」
- 広告（`src/ads.js`。AdMob。本番の広告ユニット ID が空の種類は本番ビルドで出さない）
  - バナー：スタート画面と、月間表・ダイヤモンド予報を開いている間だけ（画面の下中央）
  - 全画面広告：トップから景色を見始めるとき、景色からトップへ戻るとき（毎回）
  - リワード広告：ダイヤモンド・パール予報は 2 か月分まで無料で、広告を最後まで見ると 1 年分を探せる

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリ（Google Play、App Store など）として公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可します（アプリストアでの公開・広告の掲載・販売などの商用利用は禁止、著作権表示を残すこと）。
同梱している Leaflet などは、それぞれのライセンスのままです。詳しくは [LICENSE](LICENSE) を見てください。

## データの出典

- 山の一覧：[国土地理院「日本の主な山岳標高」](https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html)（国土地理院コンテンツ利用規約に基づき加工して利用）
- 標高：[国土地理院 地理院タイル（標高タイル）](https://maps.gsi.go.jp/development/demtile.html)、[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
- 地図ライブラリ：[Leaflet](https://leafletjs.com/)（BSD-2-Clause、`vendor/leaflet/LICENSE`）
- 空中写真・地図：[地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)
- 構造物・展望台の位置と高さはおおよその値です。建物は空中写真の色から推定した架空のものです
- 星は実在の恒星ではなく、雰囲気のための疑似乱数の星です（日周運動はします）
