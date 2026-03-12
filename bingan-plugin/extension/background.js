async function getCookiesForUrl(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies;
  } catch (error) {
    console.error('获取Cookie失败:', error);
    return [];
  }
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

async function exportCookiesToDownloads() {
  try {
    const result = await chrome.storage.local.get('cookies');
    const cookies = result.cookies || {};

    const json = JSON.stringify(cookies, null, 2);
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

    // Requires "downloads" permission
    await chrome.downloads.download({
      url,
      filename: 'bingan-cookies.json',
      conflictAction: 'overwrite',
      saveAs: false
    });

    console.log('已自动导出 bingan-cookies.json 到 Downloads');
  } catch (error) {
    console.error('自动导出Cookie失败:', error);
  }
}

async function saveCookies(domain, cookies) {
  try {
    const result = await chrome.storage.local.get('cookies');
    const existingCookies = result.cookies || {};
    existingCookies[domain] = cookies;
    await chrome.storage.local.set({ cookies: existingCookies });
    console.log(`已保存 ${domain} 的Cookie，共${cookies.length}个`);

    // Auto-export to Downloads so OpenClaw plugin can read it without manual steps
    await exportCookiesToDownloads();
  } catch (error) {
    console.error('保存Cookie失败:', error);
  }
}

async function captureAndSaveCookies(url) {
  const domain = extractDomain(url);
  if (!domain) return;

  const cookies = await getCookiesForUrl(url);
  if (cookies.length > 0) {
    await saveCookies(domain, cookies);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await captureAndSaveCookies(tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureCookies' && message.url) {
    captureAndSaveCookies(message.url).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('饼干扩展已安装');
});
