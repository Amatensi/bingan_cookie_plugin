import type { AnyAgentTool, OpenClawPluginApi, OpenClawPluginToolFactory } from "openclaw/plugin-sdk";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// NOTE: Keep this plugin dependency-free.
// OpenClaw accepts standard JSON Schema objects for `parameters`.

const PLATFORM_NAMES = {
  "xiaohongshu.com": "小红书",
  "zhipin.com": "BOSS直聘",
  "zhihu.com": "知乎",
  "weibo.com": "微博",
  "taobao.com": "淘宝",
  "jd.com": "京东",
  "bilibili.com": "B站",
  "douyin.com": "抖音",
  "github.com": "GitHub",
  "google.com": "Google",
  "baidu.com": "百度"
};

function getPlatformName(domain: string): string {
  for (const [key, name] of Object.entries(PLATFORM_NAMES)) {
    if (domain.includes(key)) {
      return name;
    }
  }
  return domain;
}

function getCookieStoragePath(): string {
  const homeDir = os.homedir();
  const chromeUserDataDir = path.join(homeDir, ".openclaw", "browser", "openclaw", "user-data", "Default", "Local Extension Settings");
  
  return chromeUserDataDir;
}

function formatCookieString(cookies: Array<{ name: string; value: string }>): string {
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}

async function loadCookiesFromStorage(api: OpenClawPluginApi): Promise<Record<string, Array<{ name: string; value: string }>>> {
  try {
    // Preferred: OpenClaw runtime config directory
    const configDir = path.join(os.homedir(), ".openclaw");
    const cookieFile = path.join(configDir, "bingan-cookies.json");

    if (fs.existsSync(cookieFile)) {
      const content = fs.readFileSync(cookieFile, "utf-8");
      return JSON.parse(content);
    }

    // Fallback: auto-exported file from browser extension (Downloads)
    const downloadsCookieFile = path.join(os.homedir(), "Downloads", "bingan-cookies.json");
    if (fs.existsSync(downloadsCookieFile)) {
      const content = fs.readFileSync(downloadsCookieFile, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    api.logger?.warn?.("加载Cookie失败: " + String(error));
  }

  return {};
}

async function saveCookiesToStorage(api: OpenClawPluginApi, cookies: Record<string, Array<{ name: string; value: string }>>): Promise<void> {
  try {
    const configDir = path.join(os.homedir(), ".openclaw");
    const cookieFile = path.join(configDir, "bingan-cookies.json");
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
  } catch (error) {
    api.logger?.error?.("保存Cookie失败: " + String(error));
  }
}

function createBinganTool(api: OpenClawPluginApi): AnyAgentTool {
  return {
    name: "bingan_get_cookies",
    label: "获取平台Cookie",
    description: "获取饼干插件中保存的各平台Cookie值。可通过平台名称或域名查询，返回结果包含平台名称、域名和Cookie值。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        platform: {
          type: "string",
          description: "目标平台，支持平台名称（如：小红书、BOSS直聘）或域名。不提供则返回所有平台的Cookie列表"
        }
      }
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const platform = typeof params.platform === "string" ? params.platform.trim() : "";
      
      api.logger?.info?.(`饼干插件：获取Cookie请求 - platform=${platform || "all"}`);
      
      const allCookies = await loadCookiesFromStorage(api);
      const domains = Object.keys(allCookies);
      
      if (domains.length === 0) {
        return {
          content: [{ type: "text", text: "暂无保存的Cookie。请先使用浏览器扩展访问网站并完成登录；扩展会自动抓取并导出 bingan-cookies.json（默认到 Downloads），本插件会自动读取。" }],
          details: { 
            success: false, 
            error: "No cookies found",
            available_platforms: []
          }
        };
      }
      
      const availablePlatforms = domains.map(domain => ({
        name: getPlatformName(domain),
        domain: domain
      }));
      
      if (platform) {
        let matchedResult: any = null;
        
        for (const domain of domains) {
          const platName = getPlatformName(domain);
          if (
            domain.toLowerCase().includes(platform.toLowerCase()) || 
            platName.toLowerCase().includes(platform.toLowerCase())
          ) {
            matchedResult = {
              success: true,
              platform: platName,
              domain: domain,
              cookie_string: formatCookieString(allCookies[domain]),
              cookies: allCookies[domain]
            };
            break;
          }
        }
        
        if (matchedResult) {
          return {
            content: [{ 
              type: "text", 
              text: `已找到 ${matchedResult.platform} 的Cookie：\n\n平台: ${matchedResult.platform}\n域名: ${matchedResult.domain}\n\nCookie值:\n${matchedResult.cookie_string}` 
            }],
            details: matchedResult
          };
        } else {
          return {
            content: [{ 
              type: "text", 
              text: `未找到平台 "${platform}" 的Cookie。\n\n当前可用的平台：\n${availablePlatforms.map(p => `- ${p.name} (${p.domain})`).join("\n")}` 
            }],
            details: { 
              success: false, 
              error: "Platform not found", 
              requested_platform: platform,
              available_platforms: availablePlatforms
            }
          };
        }
      }
      
      const result = {
        success: true,
        available_platforms: availablePlatforms,
        platforms: domains.map(domain => ({
          name: getPlatformName(domain),
          domain: domain,
          cookie_string: formatCookieString(allCookies[domain]),
          cookies: allCookies[domain]
        }))
      };
      
      return {
        content: [{ 
          type: "text", 
          text: `当前已保存 ${domains.length} 个平台的Cookie：\n\n${result.platforms.map(p => `• ${p.name} (${p.domain})\n  Cookie: ${p.cookie_string.substring(0, 100)}...`).join("\n\n")}` 
        }],
        details: result
      };
    }
  };
}

function createBinganSaveTool(api: OpenClawPluginApi): AnyAgentTool {
  return {
    name: "bingan_save_cookie",
    label: "保存平台Cookie",
    description: "手动保存指定平台的Cookie值到饼干插件中",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["domain", "cookie_string"],
      properties: {
        domain: { type: "string", description: "网站域名，如 xiaohongshu.com" },
        cookie_string: { type: "string", description: "Cookie字符串，格式为 name1=value1; name2=value2" },
        platform_name: { type: "string", description: "平台名称（可选），如：小红书" }
      }
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const domain = typeof params.domain === "string" ? params.domain.trim() : "";
      const cookieString = typeof params.cookie_string === "string" ? params.cookie_string.trim() : "";
      const platformName = typeof params.platform_name === "string" ? params.platform_name.trim() : "";
      
      if (!domain || !cookieString) {
        return {
          content: [{ type: "text", text: "请提供域名和Cookie字符串" }],
          details: { error: "Missing required parameters" }
        };
      }
      
      const cookies: Array<{ name: string; value: string }> = [];
      const pairs = cookieString.split(";").map(p => p.trim()).filter(Boolean);
      
      for (const pair of pairs) {
        const [name, ...valueParts] = pair.split("=");
        if (name) {
          cookies.push({
            name: name.trim(),
            value: valueParts.join("=").trim()
          });
        }
      }
      
      const allCookies = await loadCookiesFromStorage(api);
      allCookies[domain] = cookies;
      await saveCookiesToStorage(api, allCookies);
      
      const platName = platformName || getPlatformName(domain);
      
      api.logger?.info?.(`饼干插件：已保存 ${platName} (${domain}) 的Cookie，共${cookies.length}个`);
      
      return {
        content: [{ type: "text", text: `已成功保存 ${platName} 的Cookie，共${cookies.length}个` }],
        details: {
          platform: platName,
          domain: domain,
          cookie_count: cookies.length
        }
      };
    }
  };
}

function createBinganImportTool(api: OpenClawPluginApi): AnyAgentTool {
  return {
    name: "bingan_import_cookies",
    label: "导入Cookie文件",
    description: "从浏览器扩展导出的JSON文件中导入Cookie",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["file_path"],
      properties: {
        file_path: {
          type: "string",
          description: "导出的Cookie文件路径，如 C:\\Users\\...\\Downloads\\bingan-cookies.json"
        }
      }
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const filePath = typeof params.file_path === "string" ? params.file_path.trim() : "";
      
      if (!filePath) {
        return {
          content: [{ type: "text", text: "请提供Cookie文件路径" }],
          details: { error: "Missing file_path parameter" }
        };
      }
      
      try {
        if (!fs.existsSync(filePath)) {
          return {
            content: [{ type: "text", text: `文件不存在: ${filePath}` }],
            details: { error: "File not found", path: filePath }
          };
        }
        
        const content = fs.readFileSync(filePath, "utf-8");
        const importData = JSON.parse(content);
        
        const allCookies = await loadCookiesFromStorage(api);
        let importedCount = 0;
        
        for (const [domain, data] of Object.entries(importData)) {
          const domainData = data as any;
          if (domainData.cookies) {
            allCookies[domain] = domainData.cookies;
            importedCount++;
          }
        }
        
        await saveCookiesToStorage(api, allCookies);
        
        api.logger?.info?.(`饼干插件：已导入 ${importedCount} 个平台的Cookie`);
        
        return {
          content: [{ type: "text", text: `成功导入 ${importedCount} 个平台的Cookie` }],
          details: {
            imported_count: importedCount,
            platforms: Object.keys(importData)
          }
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `导入失败: ${String(error)}` }],
          details: { error: String(error) }
        };
      }
    }
  };
}

export default function register(api: OpenClawPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createBinganTool(api) as AnyAgentTool;
    }) as OpenClawPluginToolFactory,
    { optional: true }
  );
  
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createBinganSaveTool(api) as AnyAgentTool;
    }) as OpenClawPluginToolFactory,
    { optional: true }
  );
  
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createBinganImportTool(api) as AnyAgentTool;
    }) as OpenClawPluginToolFactory,
    { optional: true }
  );
  
  api.registerCommand({
    name: "bingan",
    description: "饼干插件管理命令 - 查看和管理保存的Cookie",
    acceptsArgs: true,
    handler: async (ctx) => {
      const args = ctx.args?.trim() ?? "";
      const tokens = args.split(/\s+/).filter(Boolean);
      const action = tokens[0]?.toLowerCase() ?? "";
      
      api.logger?.info?.(`饼干插件：/bingan命令 - action=${action || "list"}`);
      
      if (action === "list" || action === "") {
        const allCookies = await loadCookiesFromStorage(api);
        const domains = Object.keys(allCookies);
        
        if (domains.length === 0) {
          return { text: "🍪 饼干插件\n\n暂无保存的Cookie，请先通过浏览器扩展访问网站并登录，然后导出并导入。" };
        }
        
        const lines = ["🍪 饼干插件 - 已保存的Cookie\n"];
        for (const domain of domains) {
          const platName = getPlatformName(domain);
          const count = allCookies[domain].length;
          lines.push(`• ${platName} (${domain}) - ${count} 个Cookie`);
        }
        
        return { text: lines.join("\n") };
      }
      
      if (action === "import") {
        const filePath = tokens.slice(1).join(" ").trim();
        if (!filePath) {
          return { text: "🍪 饼干插件\n\n请指定要导入的文件路径，例如：\n/bingan import C:\\Users\\...\\Downloads\\bingan-cookies.json" };
        }
        
        try {
          if (!fs.existsSync(filePath)) {
            return { text: `🍪 饼干插件\n\n文件不存在: ${filePath}` };
          }
          
          const content = fs.readFileSync(filePath, "utf-8");
          const importData = JSON.parse(content);
          
          const allCookies = await loadCookiesFromStorage(api);
          let importedCount = 0;
          
          for (const [domain, data] of Object.entries(importData)) {
            const domainData = data as any;
            if (domainData.cookies) {
              allCookies[domain] = domainData.cookies;
              importedCount++;
            }
          }
          
          await saveCookiesToStorage(api, allCookies);
          
          return { 
            text: `🍪 饼干插件\n\n成功导入 ${importedCount} 个平台的Cookie` 
          };
        } catch (error) {
          return { text: `🍪 饼干插件\n\n导入失败: ${String(error)}` };
        }
      }
      
      if (action === "clear") {
        if (tokens[1]?.toLowerCase() === "all") {
          await saveCookiesToStorage(api, {});
          return { text: "🍪 饼干插件\n\n已清空所有Cookie" };
        }
        
        const target = tokens.slice(1).join(" ").trim();
        if (!target) {
          return { text: "🍪 饼干插件\n\n请指定要清除的平台，或使用 /bingan clear all 清空全部" };
        }
        
        const allCookies = await loadCookiesFromStorage(api);
        let removed = false;
        
        for (const domain of Object.keys(allCookies)) {
          const platName = getPlatformName(domain);
          if (domain.includes(target) || platName.includes(target)) {
            delete allCookies[domain];
            removed = true;
            break;
          }
        }
        
        if (removed) {
          await saveCookiesToStorage(api, allCookies);
          return { text: `🍪 饼干插件\n\n已清除 ${target} 的Cookie` };
        } else {
          return { text: `🍪 饼干插件\n\n未找到平台 "${target}"` };
        }
      }
      
      return {
        text: [
          "🍪 饼干插件 - 使用帮助",
          "",
          "可用命令：",
          "  /bingan              - 列出所有保存的Cookie",
          "  /bingan list         - 列出所有保存的Cookie",
          "  /bingan import <文件路径> - 从浏览器扩展导出的文件导入Cookie",
          "  /bingan clear <平台> - 清除指定平台的Cookie",
          "  /bingan clear all    - 清空所有Cookie",
          "",
          "智能体工具：",
          "  bingan_get_cookies    - 获取Cookie",
          "  bingan_save_cookie    - 保存Cookie",
          "  bingan_import_cookies - 导入Cookie文件"
        ].join("\n")
      };
    }
  });
  
  api.logger?.info?.("🍪 饼干插件已加载");
}
