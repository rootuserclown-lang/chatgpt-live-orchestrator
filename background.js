const CHATGPT_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com"
]);

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

  const candidates = tabs
    .filter(tab => isChatGPTUrl(tab.url))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return (b.id || 0) - (a.id || 0);
    });

  return candidates[0] || null;
}

async function openOrReuseChatGPT() {
  const existing = await findChatGPTTab();

  if (existing?.id != null) {
    await chrome.windows.update(existing.windowId, {
      focused: true
    });

    await chrome.tabs.update(existing.id, {
      active: true
    });

    return {
      tab: existing,
      reused: true
    };
  }

  const tab = await chrome.tabs.create({
    url: CHATGPT_URL,
    active: true
  });

  return {
    tab,
    reused: false
  };
}

async function ensureBridge(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "PING_CHATGPT"
    });

    return true;
  } catch {
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: false
      },
      files: ["content.js"]
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "PING_CHATGPT"
      });

      return true;
    } catch {
      return false;
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["workflows"], result => {
    if (!result.workflows) {
      chrome.storage.local.set({
        workflows: {}
      });
    }
  });

  chrome.sidePanel
    .setPanelBehavior({
      openPanelOnActionClick: true
    })
    .catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({
      openPanelOnActionClick: true
    })
    .catch(console.error);
});

chrome.action.onClicked.addListener(async tab => {
  try {
    await chrome.sidePanel.open({
      windowId: tab.windowId
    });
  } catch (error) {
    console.error(
      "Could not open side panel:",
      error
    );
  }
});

chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {

    if (message?.type === "OPEN_CHATGPT") {
      openOrReuseChatGPT()
        .then(async result => {
          if (result.tab?.id != null) {
            await ensureBridge(result.tab.id);
          }

          reply({
            ok: true,
            tabId: result.tab?.id ?? null,
            reused: result.reused
          });
        })
        .catch(error => {
          reply({
            ok: false,
            error: error.message
          });
        });

      return true;
    }

    if (message?.type === "FIND_CHATGPT") {
      findChatGPTTab()
        .then(async tab => {
          let ready = false;

          if (tab?.id != null) {
            ready = await ensureBridge(tab.id);
          }

          reply({
            ok: true,
            tabId: tab?.id ?? null,
            windowId: tab?.windowId ?? null,
            url: tab?.url ?? null,
            ready
          });
        })
        .catch(error => {
          reply({
            ok: false,
            error: error.message
          });
        });

      return true;
    }

    if (message?.type === "ENSURE_BRIDGE") {
      ensureBridge(message.tabId)
        .then(ready => reply({
          ok: ready
        }))
        .catch(error => reply({
          ok: false,
          error: error.message
        }));

      return true;
    }
  }
);
