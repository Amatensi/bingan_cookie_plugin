# bingan-cookie-plugin（饼干）

一个用于 **自动抓取 / 保存 / 导出 Cookie** 的 OpenClaw 插件 + 浏览器扩展组合。

- 浏览器扩展：自动从当前已登录网站读取 Cookie → 保存到 `chrome.storage.local` → 自动导出到 `Downloads/bingan-cookies.json`
- OpenClaw 插件：自动读取 Cookie 文件（优先 `~/.openclaw/bingan-cookies.json`，找不到则读取 `~/Downloads/bingan-cookies.json`）并提供工具 `bingan_get_cookies / bingan_save_cookie`

> 安全提示：`bingan-cookies.json` 属于敏感凭证文件，**不要上传到 GitHub**。

---

## 安装（OpenClaw 插件）

在本机命令行执行：

```bash
openclaw plugins install <本插件目录>
# 例如：openclaw plugins install C:\path\to\bingan-plugin
```

然后重启 gateway：

```bash
openclaw gateway restart
```

---

## 安装（浏览器扩展）

1. 打开 Chrome 扩展管理页：`chrome://extensions`
2. 打开 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本仓库中的：

```text
extension/
```

加载完成后，建议点一次 **Reload（重新加载）**，确保权限（含 `downloads`）生效。

---

## 使用说明

- 正常在浏览器里登录目标网站（如 xiaohongshu.com / zhipin.com）
- 页面加载完成后扩展会自动抓取并导出：
  - `C:\Users\<你>\Downloads\bingan-cookies.json`
- 在 OpenClaw 里调用：
  - `bingan_get_cookies`：查看已保存平台
  - `bingan_save_cookie`：手动保存指定域名 Cookie（备用）

---

## 开发/打包

### 生成 npm 包（可选）

在插件目录执行：

```bash
npm pack
```

会生成 `*.tgz`，可以用：

```bash
openclaw plugins install .\<生成的tgz>
```

---

## 目录结构

- `index.ts`：OpenClaw 插件入口
- `extension/`：Chrome MV3 扩展
- `.gitignore`：忽略 cookie 导出文件等
