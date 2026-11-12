// src/entrypoints/background.ts

export default defineBackground(() => {
  // 接收 content 的执行请求，向目标页注入适配脚本
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RUN_USER_SCRIPT') {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ success: false, error: '无法获取目标 Tab ID' });
        return;
      }

      try {
        (chrome as any).userScripts.execute({
          target: { tabId },
          js: [{ code: message.code }],
          world: 'MAIN',
          injectImmediately: true,
        }).then(() => {
          sendResponse({ success: true });
        }).catch((err: any) => {
          console.error('[background] 脚本注入失败:', err);
          sendResponse({ success: false, error: err.message });
        });
      } catch (err: any) {
        console.error('[background] 调用 execute 发生异常:', err);
        sendResponse({ success: false, error: err.message });
      }

      return true;
    }
  });

  // 点击扩展图标打开侧边栏：Firefox 用 sidebarAction，Chrome 用 sidePanel
  if (import.meta.env.FIREFOX) {
    browser.browserAction.onClicked.addListener(() => {
      (browser as any).sidebarAction.open();
    });
  } else if ('sidePanel' in browser) {
    (browser as any).sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: unknown) =>
        console.error('[background] 设置侧边栏行为失败:', error),
      );
  }
});