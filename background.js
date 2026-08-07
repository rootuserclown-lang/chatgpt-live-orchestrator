chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["workflows"], (r) => {
    if (!r.workflows) chrome.storage.local.set({workflows:{}});
  });
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.error);
});

// Explicit fallback: clicking the toolbar icon opens the side panel.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({windowId: tab.windowId});
  } catch (e) {
    console.error("Could not open side panel:", e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "OPEN_CHATGPT") {
    chrome.tabs.create({url:"https://chatgpt.com/"})
      .then(tab => reply({ok:true,tabId:tab.id}))
      .catch(e => reply({ok:false,error:e.message}));
    return true;
  }
});
