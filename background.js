const CHATGPT_HOSTS = new Set(["chatgpt.com", "chat.openai.com"]);
const CHATGPT_URL = "https://chatgpt.com/";

function isChatGPTUrl(url = "") {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && CHATGPT_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

async function findChatGPTTab() {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter(t => isChatGPTUrl(t.url));
  if (!candidates.length) return null;

  const complete = candidates.filter(t => t.status === "complete");

  return (complete.length ? complete : candidates)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] || null;
}

async function openOrReuseChatGPT() {
  const existing = await findChatGPTTab();

  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });

    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }

    return existing;
  }

  return chrome.tabs.create({
    url: CHATGPT_URL,
    active: true
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["workflows"], r => {
    if (!r.workflows) {
      chrome.storage.local.set({ workflows: {} });
    }
  });

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
});

chrome.action.onClicked.addListener(async tab => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.error("Could not open side panel:", e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "OPEN_CHATGPT") {
    openOrReuseChatGPT()
      .then(tab => reply({
        ok: true,
        tabId: tab?.id ?? null,
        reused: !!tab
      }))
      .catch(e => reply({
        ok: false,
        error: e.message
      }));

    return true;
  }

  if (msg?.type === "FIND_CHATGPT") {
    findChatGPTTab()
      .then(tab => reply({
        ok: true,
        tabId: tab?.id ?? null,
        windowId: tab?.windowId ?? null,
        url: tab?.url ?? null
      }))
      .catch(e => reply({
        ok: false,
        error: e.message
      }));

    return true;
  }
});
