function testAll() {
    testIncludesSkippingString();
  }

  function testIncludesSkippingString() {
    let testString1 = '【使い方を見る】';
    let testString2 = '【よくある質問】';
    let testString3 = '【スキップしない文字列のテスト】';
    let testString4 = '【使い方を見る】文字列が含まれる場合はスキップされるのを確認';
    let testString5 = '@みのっち メンションがついているとスキップされる';

    if (includesSkippingString(testString1)) {
      console.log('testIncludesSkippingString 1: success');
    } else {
      console.error('testIncludesSkippingString 1: error');
    }
    if (includesSkippingString(testString2)) {
      console.log('testIncludesSkippingString 2: success');
    } else {
      console.error('testIncludesSkippingString 2: error');
    }
    if (!includesSkippingString(testString3)) {
      console.log('testIncludesSkippingString 3: success');
    } else {
      console.error('testIncludesSkippingString 3: error');
    }
    if (includesSkippingString(testString4)) {
      console.log('testIncludesSkippingString 4: success');
    } else {
      console.error('testIncludesSkippingString 4: error');
    }
    if (includesSkippingString(testString5)) {
      console.log('testIncludesSkippingString 5: success');
    } else {
      console.error('testIncludesSkippingString 5: error');
    }
  }