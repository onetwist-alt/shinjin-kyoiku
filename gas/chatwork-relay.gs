/**
 * 新人教育アプリ → チャットワーク 通知の中継
 *
 * 【使い方】
 * 1. https://script.google.com で新しいプロジェクトを作り、このコードを貼り付ける
 * 2. 左メニューの「プロジェクトの設定」→「スクリプト プロパティ」で次の2つを追加
 *      CHATWORK_TOKEN : チャットワークの API トークン
 *      ROOM_ID        : 通知先のルームID（アプリ側でも指定できるので省略可）
 * 3. 右上「デプロイ」→「新しいデプロイ」→ 種類：ウェブアプリ
 *      次のユーザーとして実行 : 自分
 *      アクセスできるユーザー : 全員
 *    → 表示された URL（.../exec）をアプリの設定画面に貼る
 *
 * ※ トークンはこのスクリプトの中だけに保存されます（アプリ側には出ません）
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('CHATWORK_TOKEN');
    var room = data.room || props.getProperty('ROOM_ID');
    if (!token || !room) return out({ ok: false, error: 'CHATWORK_TOKEN または ROOM_ID が未設定です' });

    var text = String(data.text || '').slice(0, 4000);
    if (!text) return out({ ok: false, error: 'text がありません' });

    var res = UrlFetchApp.fetch('https://api.chatwork.com/v2/rooms/' + encodeURIComponent(room) + '/messages', {
      method: 'post',
      headers: { 'X-ChatWorkToken': token },
      payload: { body: text },
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    return out({ ok: code === 200, status: code, body: res.getContentText().slice(0, 300) });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/* ブラウザで URL を直接開いたときの確認用 */
function doGet() {
  return out({ ok: true, message: '新人教育アプリのチャットワーク中継です。稼働中。' });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* エディタ上から動作確認するとき用（実行ボタンで送信テスト） */
function testSend() {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch('https://api.chatwork.com/v2/rooms/' + props.getProperty('ROOM_ID') + '/messages', {
    method: 'post',
    headers: { 'X-ChatWorkToken': props.getProperty('CHATWORK_TOKEN') },
    payload: { body: '[info][title]テスト[/title]GAS からの送信テストです[/info]' },
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
