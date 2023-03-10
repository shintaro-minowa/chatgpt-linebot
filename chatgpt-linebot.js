// 環境変数
const LINE_ACCESS_TOKEN = '';
const OPENAI_APIKEY = '';
const SHEET_ID = '';
const SYSTEM_TEXT = "";

// 以降は全環境で統一
const CHAT_GPT_URL = 'https://api.openai.com/v1/chat/completions';
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const HISTORY_NUM = 3;
const QUESTION_NUM = 10;
const USAGE_LIMIT = 1000;
const MAX_LENGTH_INPUT = 1000;
const MAX_LENGTH_OUTPUT = 4000;
const sheet = SpreadsheetApp.openById(SHEET_ID);
const historySheet = sheet.getSheetByName("history");
const questionsSheet = sheet.getSheetByName("questions");
const logSheet = sheet.getSheetByName("log");
const errorLogSheet = sheet.getSheetByName("error_log");

function doPost(e) {
  try {
    Logger.log("doPost start");
    // イベントを取得
    const event = getEvent(e);

    Logger.log('event.type: ' + event.type);
    // イベントが何であるか
    if (event.type !== 'message') {
      // イベントがメッセージイベント以外の場合、処理終了
      Logger.log("event.type !== 'message'");
      saveLog(Logger.getLog());
      return;
    }

    // イベントがメッセージイベントの場合

    // ユーザーIDを取得
    const userId = event.source.userId;
    Logger.log('userId: ' + userId);
    // リプライトークンを取得
    const replyToken = event.replyToken;
    Logger.log('replyToken: ' + replyToken);

    Logger.log('event.message.type: ' + event.message.type);
    if (event.message.type !== 'text') {
      // メッセージイベントのタイプがテキストメッセージ以外（動画やスタンプ）の場合
      // 以下のメッセージをユーザに返信し、処理終了
      replyMessage(replyToken, 'テキストメッセージを送信してください。');
      saveLog(Logger.getLog());
      return;
    }

    if (isOverUsageLimit(userId)) {
      // 利用制限回数の上限に達した場合、以下のメッセージをユーザに返信し、処理終了
      replyMessage(replyToken, 'いつもご利用いただきありがとうございます。\n本日の利用制限回数に到達しました🙇‍♂');
      Logger.log('利用制限超過');
      saveLog(Logger.getLog());
      return;
    }

    // メッセージイベントのタイプがテキストメッセージの場合
    // ユーザからのメッセージ取得
    let userMessage = event.message.text;
    Logger.log('userMessage: ' + userMessage);

    // メッセージを MAX_LENGTH_INPUT の値で切り捨て
    userMessage = userMessage.substring(0, MAX_LENGTH_INPUT);

    // ChatGPTに渡すmessageを作成
    const messages = createChatGPTRequestMessage(userId, userMessage);

    // chatgptの回答取得
    let chatGptMessage = requestChatGPT(messages);

    // LINEで返信する文章は最大5000文字
    // https://developers.line.biz/ja/reference/messaging-api/#text-message
    // ChatGPTからのレスポンスを MAX_LENGTH_OUTPUT の値で切り捨て
    chatGptMessage = chatGptMessage.substring(0, MAX_LENGTH_OUTPUT);

    // 会話の履歴を保存
    saveConversation(userId, userMessage, chatGptMessage);

    // ユーザに返信
    replyMessage(replyToken, chatGptMessage);

    // ログを保存
    saveLog(Logger.getLog());

    // 処理終了
    return;
  } catch (error) {
    Logger.log(error);
    saveLog(Logger.getLog());
    saveErrorLog(Logger.getLog());
  }
}

// イベントを取得する処理
function getEvent(e) {
  // LINE Developers Messaging APIリファレンス
  // https://developers.line.biz/ja/reference/messaging-api/#webhook-event-objects
  return JSON.parse(e.postData.contents).events[0];
}

function requestChatGPT(messages) {
  let text = '';
  try {
    const requestOptions = {
      "method": "post",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_APIKEY
      },
      "payload": JSON.stringify({
        "model": "gpt-3.5-turbo",
        "messages": messages
      })
    }

    // ChatGPTのAPIをリクエストする
    Logger.log("call ChatGPT API");
    const response = UrlFetchApp.fetch(CHAT_GPT_URL, requestOptions);
    Logger.log("called ChatGPT API");

    const responseText = response.getContentText();
    const json = JSON.parse(responseText);
    text = json['choices'][0]['message']['content'].trim();

    // 消費したトークン数
    const usage = json['usage'];
    Logger.log('prompt_tokens: ' + usage['prompt_tokens']);
    Logger.log('completion_tokens: ' + usage['completion_tokens']);
    Logger.log('total_tokens: ' + usage['total_tokens']);

  } catch (error) {
    Logger.log(error);
    saveErrorLog(Logger.getLog());

    text = 'ChatGPTが正常に応答しませんでした。しばらく待ってから再度お試しください。';
  }
  Logger.log("text:" + text);
  return text;
}

function createChatGPTRequestMessage(userId, userMessage) {
  // スプレッドシートから会話の履歴を全件取得
  const data = historySheet.getDataRange().getValues();
  // userIdでフィルタリング
  const userRows = data.filter(row => row[0] === userId);
  // 最新の会話を取得
  const latestRows = userRows.slice(-HISTORY_NUM);

  let messages = [];

  // AIの性格を指定する文を入れる
  messages.unshift({ "role": "system", "content": SYSTEM_TEXT });
  Logger.log('role: system, content: ' + SYSTEM_TEXT);

  // 最新の会話を入れる
  latestRows.forEach(function (row) {
    messages.push({ "role": "user", "content": row[1] });
    messages.push({ "role": "assistant", "content": row[2] });
    Logger.log('role: user, content: ' + row[1]);
    Logger.log('role: assistant, content: ' + row[2]);
  });

  // 現在のメッセージを入れる
  messages.push({ "role": "user", "content": userMessage });
  Logger.log('role: user, content: ' + userMessage);

  return messages;
}

function saveConversation(userId, userMessage, chatGptMessage) {
  const lastRow = historySheet.getLastRow();
  // 現在日時を取得
  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

  // スプレッドシートに最新の会話を出力
  historySheet.getRange(lastRow + 1, 1).setValue(userId);
  historySheet.getRange(lastRow + 1, 2).setValue(userMessage);
  historySheet.getRange(lastRow + 1, 3).setValue(chatGptMessage);
  historySheet.getRange(lastRow + 1, 4).setValue(now);
}

function replyMessage(replyToken, text) {
  // quickReplyの選択肢を取得
  const quickReplyOptions = getQuickReplyOptions();

  UrlFetchApp.fetch(LINE_REPLY_URL, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': text,
        'quickReply': quickReplyOptions
      }]
    })
  });
  return ContentService.createTextOutput(JSON.stringify({ 'content': 'post ok' })).setMimeType(ContentService.MimeType.JSON);
}

function getQuickReplyOptions() {
  // スプレッドシートから質問例を全件取得
  const lastRow = questionsSheet.getLastRow();
  const lastColumn = questionsSheet.getLastColumn();
  // ヘッダーはスキップ
  let data = questionsSheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  // 質問例をシャッフルする
  shuffleArray(data);

  let questions = [];

  // 質問例を、questionsに追加する。
  // ヘッダーはスキップ
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const text = value[0].substr(0, 20);
    // label: 最大文字数：20
    // text: 最大文字数：300
    questions.push({ "type": "action", "action": { "type": "message", "label": text, "text": text } });

    if (i >= QUESTION_NUM - 1) {
      break;
    }
  }

  quickReplyOptions = {
    "items": questions
  }

  return quickReplyOptions;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isOverUsageLimit(userId) {
  const data = historySheet.getDataRange().getValues();
  const now = new Date(); // 現在時刻を取得
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24時間前の時刻を計算
  const userRows = data.filter(function (row) {
    return row[0] === userId && new Date(row[3]) >= oneDayAgo; // 24時間以内のデータをフィルタリング
  });
  Logger.log('userRows.length: ' + userRows.length);
  Logger.log('USAGE_LIMIT ' + USAGE_LIMIT);
  return userRows.length >= USAGE_LIMIT;
}

function saveLog(text) {
  const lastRow = logSheet.getLastRow();
  // スプレッドシートにログを出力
  logSheet.getRange(lastRow + 1, 1).setValue(text);
}

function saveErrorLog(text) {
  const lastRow = errorLogSheet.getLastRow();
  // スプレッドシートにログを出力
  errorLogSheet.getRange(lastRow + 1, 1).setValue(text);
}
