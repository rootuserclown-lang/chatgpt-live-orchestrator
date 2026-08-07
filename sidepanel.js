const $ = id => document.getElementById(id);

const trace = [];

let recognition = null;

function log(type, message) {
  trace.push(
    `[${new Date().toLocaleTimeString()}] ${type}: ${message}`
  );

  $("trace").textContent =
    trace.slice(-40).join("\n");
}

async function locateChatGPT() {
  const result =
    await chrome.runtime.sendMessage({
      type: "FIND_CHATGPT"
    });

  if (
    result?.ok &&
    result.tabId != null
  ) {
    return await chrome.tabs.get(
      result.tabId
    );
  }

  const opened =
    await chrome.runtime.sendMessage({
      type: "OPEN_CHATGPT"
    });

  if (
    !opened?.ok ||
    opened.tabId == null
  ) {
    throw new Error(
      opened?.error ||
      "Could not locate ChatGPT."
    );
  }

  return await chrome.tabs.get(
    opened.tabId
  );
}

async function ensureChatGPTReady(tab) {
  let ready = false;

  try {
    const ping =
      await chrome.tabs.sendMessage(
        tab.id,
        {
          type: "PING_CHATGPT"
        }
      );

    ready = !!ping?.ok;
  } catch {
    const result =
      await chrome.runtime.sendMessage({
        type: "ENSURE_BRIDGE",
        tabId: tab.id
      });

    ready = !!result?.ok;
  }

  if (!ready) {
    throw new Error(
      "Could not establish the ChatGPT bridge."
    );
  }
}

async function sendText(text) {
  const tab =
    await locateChatGPT();

  await ensureChatGPTReady(tab);

  let result;

  try {
    result =
      await chrome.tabs.sendMessage(
        tab.id,
        {
          type: "SEND_PROMPT",
          text
        }
      );
  } catch {
    await ensureChatGPTReady(tab);

    result =
      await chrome.tabs.sendMessage(
        tab.id,
        {
          type: "SEND_PROMPT",
          text
        }
      );
  }

  if (!result?.ok) {
    throw new Error(
      result?.error ||
      "Could not send prompt."
    );
  }

  log(
    "EXECUTE",
    `Prompt submitted via ${result.method || "bridge"}.`
  );
}

$("send").onclick = async () => {
  const text =
    $("prompt").value.trim();

  if (!text) return;

  try {
    await sendText(text);

    $("prompt").value = "";

    $("response").textContent =
      "Waiting for visible response…";
  } catch (error) {
    log(
      "ERROR",
      error.message
    );
  }
};

$("continue").onclick = async () => {
  try {
    const tab =
      await locateChatGPT();

    await ensureChatGPTReady(tab);

    const result =
      await chrome.tabs.sendMessage(
        tab.id,
        {
          type: "CAPTURE_RESPONSE"
        }
      );

    if (result?.text) {
      $("response").textContent =
        result.text;

      log(
        "OBSERVE",
        "Captured current visible response."
      );
    } else {
      log(
        "OBSERVE",
        "No visible response found."
      );
    }
  } catch (error) {
    log(
      "ROUTE",
      error.message
    );
  }
};

$("newchat").onclick = async () => {
  try {
    const result =
      await chrome.runtime.sendMessage({
        type: "OPEN_CHATGPT"
      });

    if (!result?.ok) {
      throw new Error(
        result?.error ||
        "Could not open ChatGPT."
      );
    }

    log(
      "ROUTE",
      result.reused
        ? "Reused existing ChatGPT target."
        : "Opened a new ChatGPT target."
    );
  } catch (error) {
    log(
      "ERROR",
      error.message
    );
  }
};

$("mic").onclick = () => {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    log(
      "VOICE",
      "Speech recognition is unavailable in this browser context."
    );

    return;
  }

  try {
    recognition =
      new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      navigator.language || "en-US";

    recognition.onstart = () => {
      $("mic").disabled = true;
      $("stop").disabled = false;

      log(
        "VOICE",
        "Listening."
      );
    };

    recognition.onresult = event => {
      let text = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        text +=
          event.results[i][0].transcript;
      }

      $("prompt").value = text;
    };

    recognition.onerror = event => {
      log(
        "VOICE",
        `Error: ${event.error}`
      );
    };

    recognition.onend = () => {
      $("mic").disabled = false;
      $("stop").disabled = true;
    };

    recognition.start();
  } catch (error) {
    log(
      "VOICE",
      `Could not start recognition: ${error.message}`
    );
  }
};

$("stop").onclick = () => {
  recognition?.stop();
};
