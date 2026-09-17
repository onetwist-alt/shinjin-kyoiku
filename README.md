# 新人教育アプリ

社員が教育項目を履修 → 責任者が承認、日報を提出 → 責任者が確認、という流れのアプリです。
ビルド不要（HTML / CSS / JS のみ）。Firebase（Auth + Firestore、無料プラン）と GitHub Pages で動きます。

## ファイル構成

```
index.html          社員用の画面
admin.html          責任者用の画面（最大5アカウント）
css/style.css       共通スタイル
js/firebase-config.js  ← Firebase の設定をここに貼る（アプリ名もここ）
js/common.js        共通処理
js/employee.js      社員側の処理
js/admin.js         責任者側の処理
js/practice-data.js 練習用データ（言葉リスト・ローマ字表・ショートカット一覧）
js/practice.js      社員側の練習（タイピング・ショートカット）
firestore.rules     Firestore に貼るセキュリティルール
manifest.json / manifest-admin.json   ホーム画面追加用
icons/              アイコン
```

## セットアップの流れ（概要）

1. Firebase コンソールでプロジェクトを作る（Spark 無料プラン）
2. Authentication → ログイン方法 → 「メール / パスワード」を有効にする
3. Authentication → Users → 最初の責任者のアカウントを追加する（メール＋パスワード）
4. Firestore Database を作る（本番環境モード）→ ルールタブに `firestore.rules` の中身を貼って公開
5. Firestore → 「コレクションを開始」→ コレクション ID `admins`、ドキュメント ID に責任者のメールアドレス（小文字）、フィールド `name`（文字列）に表示名を入れて保存
6. プロジェクトの設定 → マイアプリ → ウェブアプリを追加 → 表示される `firebaseConfig` を `js/firebase-config.js` に貼る
7. GitHub にパブリックリポジトリを作り、このフォルダの中身をアップロード → Settings → Pages で公開（Branch: main / root）
8. Firebase の Authentication → 設定 → 承認済みドメイン に `ユーザー名.github.io` を追加する
9. `https://ユーザー名.github.io/リポジトリ名/admin.html` を Safari で開いてログイン → 「共有」→「ホーム画面に追加」

社員用は `https://ユーザー名.github.io/リポジトリ名/`（index.html）です。

## 教育項目のまとめ登録

責任者画面 → 項目 → まとめ登録。スプレッドシートの表（段階 / カテゴリ / チェック欄 / 題名 / 内容 の列）をコピーしてそのまま貼り付けると、
「1週目」「座学系」などの見出し行を段階・カテゴリとして自動で読み取ります（TRUE/FALSE のチェック欄は無視）。
手書きの場合は `# 1週目` `## 座学系` の見出しと `題名｜説明｜URL` の行で書けます。

## チャットワーク通知

責任者画面 → 設定 → 「チャットワーク通知」で、日報の提出・責任者の記録・上長コメントをチャットワークに通知できます。
API トークンを公開ファイルに置けないため、GAS（`gas/chatwork-relay.gs`）を中継役にしています。手順は `gas/chatwork-setup.md`。
設定値は `settings/notify`（enabled, gasUrl, roomId, events）に保存。文面を変えるときは `js/employee.js` / `js/admin.js` の `notifyChatwork(...)` を編集します。

## バックアップと社員の削除

- 責任者画面 → 設定 → 「全データを書き出す」で、全コレクションを JSON ファイルにまとめて保存できます（無料プランには自動バックアップが無いため、月1回程度の実行を推奨）。
- 社員の削除は社員詳細の「退職・削除」から。名前の入力で確認し、「記録を残して削除」「記録も完全に削除」を選べます。
  削除すると `employees/{uid}` が消え、社員側アプリはこれを監視しているため、ログイン中の端末もその場で強制ログアウトされます。
  ログイン用アカウント自体は Firebase Authentication に残るので、完全に消す場合はコンソールの Authentication → Users から削除してください。

## 一日の変わり目（朝8時）

営業時間が 10:00〜翌5:00 のため、日付の切り替わりを朝8時にしています（`js/common.js` の `DAY_START_HOUR`）。
深夜2時に出した日報や履修は前日の扱いになり、カレンダーの「今日」も朝8時までは前日を指します。変えるときは `DAY_START_HOUR` の数字だけ直してください。

## スプラッシュ（起動画面）

ログイン画面の手前に、理念メッセージをフェードインで表示します（`index.html` / `admin.html` の `#view-splash`、動きは `css/style.css` の `.splash`）。
文言を変えるときは各 HTML の `.splash-line` を編集してください。タップまたは「次へ進む」でログイン画面へ。1セッションに1回だけ表示します。

## 項目の3つの大分類

- チェック：段階（任意）・カテゴリ（任意）あり
- 説明あり：段階・カテゴリなし（常に表示）
- ビデオ：カテゴリ（任意）のみ

## 1つの責任者アカウントを複数人で使う場合

責任者画面 → 設定 → 「操作する責任者の名前」に名前を登録すると、ログイン後に「誰が操作しますか？」と聞かれ、
承認・日報の確認・指導記録・メモに選んだ名前が記録されます（名前はそのブラウザに記憶され、右上の 👤 で切り替え）。
名前リストは `settings/app.operators` に保存。日報の確認は名前をキーに保存されます。

## 段階・カテゴリの許可制

責任者画面 → 設定 → 「段階・カテゴリの許可制」をオンにすると、責任者が許可したチェックの段階・ビデオのカテゴリだけが社員に表示されます（説明ありは常に表示）。
許可は社員詳細画面の「段階・カテゴリの許可」欄でオン／オフ（`approvals/{uid}.unlocked` / `unlockedVideo` に保存）。
オンにした時点で、各社員の進行中の段階と最初の段階は自動で許可されます。

## ファイルを更新したのに画面が変わらないとき

バージョン番号は3か所で管理しています（更新用 ZIP では毎回そろえて上げてあります）。
- `index.html` / `admin.html` の `?v=39`
- `js/common.js` の `APP_VERSION`
- `version.json`

「↻ 更新」ボタンを押すと `version.json` を確認し、番号が新しければ自動でページを読み込み直します。起動時にも静かに確認します。

## アプリ名を変えるには

- `js/firebase-config.js` の `APP_NAME`
- `manifest.json` と `manifest-admin.json` の `name` / `short_name`
- 各 HTML の `<title>` と `apple-mobile-web-app-title`

## データの持ち方（Firestore）

| コレクション | 内容 |
|---|---|
| `admins/{メール}` | 責任者。ドキュメントがあれば責任者扱い |
| `employees/{uid}` | 社員（name, email, active） |
| `items/{id}` | 教育項目（title, description, type＝check/text/video, videoUrl, phase＝段階（チェックのみ）, group＝カテゴリ（チェック・ビデオ）, order, published, autoBy＝練習合格で自動履修） |
| `progress/{uid}` | 社員が「履修済み」にした項目（done）、項目メモ（memos）、練習の記録（practice.typing / practice.shortcuts） |
| `approvals/{uid}` | 責任者の承認（items）、段階の許可（unlocked: {段階名: true}）、ビデオカテゴリの許可（unlockedVideo: {カテゴリ名: true}） |
| `reports/{id}` | 日報（uid, name, date, checks, did＝今日やったこと, notice＝気づき, next＝次回の課題, text＝結合文, confirmations） |
| `notes/{uid}` | 責任者のひとことメモ（entries）と、日別の指導記録（daily: {YYYY-MM-DD: {taught, concern, next, author, at, comments: [{text, author, at}]}}） |
| `settings/app` | アプリ設定（phaseLock: 段階の許可制） |
| `settings/practice` | タイピング練習の言葉（words, useDefault）、合格ライン（pass）、ショートカットの重要度（tiers: {id: must/useful/rare}） |
