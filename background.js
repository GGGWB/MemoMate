chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id }, (result) => {
      if (chrome.runtime.lastError) {
        // 静默忽略错误
      }
    });
  });