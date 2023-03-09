const LINE_ACCESS_TOKEN = '';
const OPENAI_APIKEY = '';
const historySheet = SpreadsheetApp.openById("").getSheetByName("history");
const questionsSheet = SpreadsheetApp.openById("").getSheetByName("questions");
const logSheet = SpreadsheetApp.openById("").getSheetByName("log");
const systemText = "";
const lineReplyUrl = 'https://api.line.me/v2/bot/message/reply';
const HistoryNum = 3;
const QuestionNum = 10;
const UsageLimit = 1000;
const MAX_LENGTH_INPUT = 1000;
const MAX_LENGTH_OUTPUT = 4000;

function doPost(e) {
  try {
    Logger.log("doPost start");
    const event = JSON.parse(e.postData.contents).events[0];

    const userId = event.source.userId;
    const replyToken = event.replyToken;
    let userMessage = event.message.text;

    Logger.log('userId: ' + userId);
    Logger.log('replyToken: ' + replyToken);
    Logger.log('userMessage: ' + userMessage);

    if (userMessage === undefined) {
      // メッセージ以外(スタンプや画像など)が送られてきた場合
      userMessage = '？？？';
    }

    // メッセージを MAX_LENGTH_INPUT の値で切り捨て
    userMessage = userMessage.substring(0, MAX_LENGTH_INPUT);

    if (isOverUsageLimit(userId)) {
      let text = "いつもご利用いただきありがとうございます。\n本日の利用制限回数に到達しました🙇‍♂";
      // LINEで返信
      lineReply(replyToken, text);

      // もし2通目を送る場合は別の処理が必要。

      // 処理終了
      return;
    }

    // ChatGPTに渡すmessageを作成
    const messages = createMessage(userId, userMessage);

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

    Logger.log("call ChatGPT API");
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", requestOptions);
    Logger.log("called ChatGPT API");

    const responseText = response.getContentText();
    const json = JSON.parse(responseText);
    let text = json['choices'][0]['message']['content'].trim();
    Logger.log("text:" + text);

    // LINEで返信する文章は最大5000文字
    // https://developers.line.biz/ja/reference/messaging-api/#text-message

    // ChatGPTからのレスポンスを MAX_LENGTH_OUTPUT の値で切り捨て
    text = text.substring(0, MAX_LENGTH_OUTPUT);

    // 消費したトークン数
    const usage = json['usage'];

    Logger.log('prompt_tokens: ' + usage['prompt_tokens']);
    Logger.log('completion_tokens: ' + usage['completion_tokens']);
    Logger.log('total_tokens: ' + usage['total_tokens']);

    // 現在の会話を保存
    saveMessage(userId, userMessage, text);

    Logger.log('doPost end');

    // ログを保存
    saveLog(Logger.getLog());

    // LINEで返信
    lineReply(replyToken, text);
  } catch (error) {
    saveLog(error);
  }
}

function createMessage(userId, userMessage) {
  // スプレッドシートから会話の履歴を全件取得
  let data = historySheet.getDataRange().getValues();
  // userIdでフィルタリング
  let userRows = data.filter(row => row[0] === userId);
  // 最新の会話を取得
  let lastFiveRows = userRows.slice(-HistoryNum);

  let messages = [];

  // AIの性格を指定する文を入れる
  messages.unshift({ "role": "system", "content": systemText });

  // 最新の会話を入れる
  lastFiveRows.forEach(function (row) {
    messages.push({ "role": "user", "content": row[1] });
    messages.push({ "role": "assistant", "content": row[2] });
  });

  // 現在のメッセージを入れる
  messages.push({ "role": "user", "content": userMessage });

  return messages;
}

function saveMessage(userId, userMessage, text) {
  const lastRow = historySheet.getLastRow();
  // 現在日時を取得
  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

  // スプレッドシートに最新の会話を出力
  historySheet.getRange(lastRow + 1, 1).setValue(userId);
  historySheet.getRange(lastRow + 1, 2).setValue(userMessage);
  historySheet.getRange(lastRow + 1, 3).setValue(text);
  historySheet.getRange(lastRow + 1, 4).setValue(now);
}

function lineReply(replyToken, text) {
  // quickReplyの選択肢を取得
  const quickReplyOptions = getQuickReplyOptions();

  UrlFetchApp.fetch(lineReplyUrl, {
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

    if (i >= QuestionNum - 1) {
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
  var data = historySheet.getDataRange().getValues();
  var now = new Date(); // 現在時刻を取得
  var oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24時間前の時刻を計算
  var userRows = data.filter(function (row) {
    return row[0] === userId && new Date(row[3]) >= oneDayAgo; // 24時間以内のデータをフィルタリング
  });
  return userRows.length >= UsageLimit;
}

function saveLog(text) {
  // 現在日時を取得
  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

  const lastRow = logSheet.getLastRow();
  // スプレッドシートにログを出力
  logSheet.getRange(lastRow + 1, 1).setValue(text);
  logSheet.getRange(lastRow + 1, 2).setValue(now);
}
