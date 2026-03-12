const PLATFORM_NAMES = {
  'xiaohongshu.com': '小红书',
  'zhipin.com': 'BOSS直聘',
  'zhihu.com': '知乎',
  'weibo.com': '微博',
  'taobao.com': '淘宝',
  'jd.com': '京东',
  'bilibili.com': 'B站',
  'douyin.com': '抖音',
  'github.com': 'GitHub',
  'google.com': 'Google',
  'baidu.com': '百度'
};

function getPlatformName(domain) {
  for (const [key, name] of Object.entries(PLATFORM_NAMES)) {
    if (domain.includes(key)) {
      return name;
    }
  }
  return domain;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

async function loadCookies() {
  const result = await chrome.storage.local.get('cookies');
  return result.cookies || {};
}

async function saveCookies(cookies) {
  await chrome.storage.local.set({ cookies });
}

function formatCookieString(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function renderCookies() {
  const cookieList = document.getElementById('cookieList');
  const cookies = await loadCookies();
  const domains = Object.keys(cookies);

  if (domains.length === 0) {
    cookieList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <p>暂无Cookie数据</p>
        <p style="font-size: 11px; margin-top: 4px;">访问网站后自动获取</p>
      </div>
    `;
    return;
  }

  cookieList.innerHTML = domains.map(domain => {
    const platformCookies = cookies[domain];
    const platformName = getPlatformName(domain);
    const cookieString = formatCookieString(platformCookies);

    return `
      <div class="platform-card" data-domain="${domain}">
        <div class="platform-header">
          <div>
            <div class="platform-name">${platformName}</div>
            <div class="platform-domain">${domain}</div>
          </div>
          <div style="font-size: 11px; color: #888;">${platformCookies.length} 个Cookie</div>
        </div>
        <div class="cookie-preview" title="${cookieString}">${cookieString}</div>
        <div class="platform-actions">
          <button class="btn-small btn-copy" data-domain="${domain}">复制</button>
          <button class="btn-small btn-delete" data-domain="${domain}">删除</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const domain = e.target.dataset.domain;
      const cookies = await loadCookies();
      const cookieString = formatCookieString(cookies[domain]);
      await navigator.clipboard.writeText(cookieString);
      showToast('已复制到剪贴板');
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const domain = e.target.dataset.domain;
      const cookies = await loadCookies();
      delete cookies[domain];
      await saveCookies(cookies);
      renderCookies();
      showToast('已删除');
    });
  });
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    chrome.runtime.sendMessage({ action: 'captureCookies', tabId: tab.id, url: tab.url });
    showToast('正在刷新...');
    setTimeout(renderCookies, 500);
  }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (confirm('确定要清空所有Cookie吗？')) {
    await saveCookies({});
    renderCookies();
    showToast('已清空');
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const cookies = await loadCookies();
  const domains = Object.keys(cookies);
  
  if (domains.length === 0) {
    showToast('没有可导出的Cookie');
    return;
  }
  
  const exportData = {};
  for (const domain of domains) {
    exportData[domain] = {
      platformName: getPlatformName(domain),
      cookies: cookies[domain],
      cookieString: formatCookieString(cookies[domain])
    };
  }
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bingan-cookies.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('已导出Cookie文件');
});

renderCookies();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.cookies) {
    renderCookies();
  }
});
