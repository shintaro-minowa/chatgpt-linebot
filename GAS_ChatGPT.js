const LINE_ACCESS_TOKEN = '';
const OPENAI_APIKEY = '';
const historySheet = SpreadsheetApp.openById("").getSheetByName("history");
const questionsSheet = SpreadsheetApp.openById("").getSheetByName("questions");
const systemText = "";
const lineReplyUrl = 'https://api.line.me/v2/bot/message/reply';
const HistoryNum = 10;
const QuestionNum = 10;

function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];

  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const userMessage = event.message.text;

  if (userMessage === undefined) {
    // メッセージ以外(スタンプや画像など)が送られてきた場合
    userMessage = '？？？';
  }

  // ChatGPTに渡すmessageを作成
  const messages = this.createMessage(userId, userMessage);

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
  const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", requestOptions);

  const responseText = response.getContentText();
  const json = JSON.parse(responseText);
  let text = json['choices'][0]['message']['content'].trim();

  // 5000文字に収まるようにする
  // https://developers.line.biz/ja/reference/messaging-api/#text-message
  text = text.substr(0, 5000);

  // 現在の会話を保存
  this.saveMessage(userId, userMessage, text);

  // LINEで返信
  this.lineReply(replyToken, text);
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
  const quickReplyOptions = this.getQuickReplyOptions();

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
  this.shuffleArray(data);

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
