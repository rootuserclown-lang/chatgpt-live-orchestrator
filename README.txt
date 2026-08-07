CHATGPT LOCAL ORCHESTRATOR v3.2

INSTALL
-------
1. Open chrome://extensions
2. Enable Developer mode.
3. Remove the previous ChatGPT Local Orchestrator copy.
4. Click Load unpacked.
5. Select THIS folder — the folder containing manifest.json directly.
6. Pin the extension if desired.
7. Click its toolbar icon. The side panel should open.

If the icon still does nothing:
- Open chrome://extensions
- Find ChatGPT Local Orchestrator
- Click Details
- Check that the extension is enabled
- Click Errors (if present) and inspect the service worker error
- Click the Reload icon on the extension, then click its toolbar icon again.

This version explicitly calls chrome.sidePanel.open() on toolbar clicks and also
registers openPanelOnActionClick as a fallback.

The extension does not grant hidden account privileges and does not execute arbitrary
operating-system commands.
