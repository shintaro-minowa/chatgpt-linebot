```
Write the following logic in javascript using object and functional programming concepts.
イベントを取得
イベントが何であるか
	<フォローイベント>
		クイックリプライを返す
		ユーザに返信
		処理終了
	<メッセージイベント>
		<動画やスタンプの場合>
			テキストメッセージを送信してください。というメッセージをユーザに返信する
			処理終了
		<テキストメッセージの場合>
			ユーザからのメッセージ取得
			chatgptの回答取得
			会話履歴保存
			ユーザに返信
	<それ以外のイベント>
		処理終了
```

Here's the logic written in JavaScript using objects and functional programming concepts:

```js
const eventHandlers = {
  'follow': () => {
    sendQuickReply();
    sendReplyToUser();
    return;
  },
  'message': () => {
    const message = getMessageFromUser();
    if (message.includes('video') || message.includes('stamp')) {
      sendReplyToUser('Please send a text message.');
      return;
    }
    const chatGptResponse = getChatGptResponse(message);
    saveChatHistory(message, chatGptResponse);
    sendReplyToUser(chatGptResponse);
    return;
  },
  'other': () => {
    return;
  }
};

function handleEvent(eventType) {
  const eventHandler = eventHandlers[eventType] || eventHandlers['other'];
  eventHandler();
}

// Example usage
handleEvent('follow');
handleEvent('message');
handleEvent('other');
```
The eventHandlers object contains a set of functions to handle different types of events. The handleEvent function takes an eventType argument and calls the appropriate function from the eventHandlers object, or the other function if the eventType is not recognized.

For the 'follow' event, the function sends a quick reply and a reply to the user, then returns. For the 'message' event, if the message contains 'video' or 'stamp', the function sends a reply asking the user to send a text message instead. Otherwise, it gets a response from chatgpt, saves the chat history, and sends the response to the user. For any other event type, the function simply returns without doing anything.
