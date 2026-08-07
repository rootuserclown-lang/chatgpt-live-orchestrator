(() => {
  if (window.__CHATGPT_LOCAL_ORCHESTRATOR__) {
    return;
  }

  window.__CHATGPT_LOCAL_ORCHESTRATOR__ = true;

  function visible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function findComposer() {
    const selectors = [
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];

    const candidates = [];

    for (const selector of selectors) {
      candidates.push(
        ...document.querySelectorAll(selector)
      );
    }

    return candidates
      .filter(visible)
      .filter(element => {
        const aria = (
          element.getAttribute("aria-label") || ""
        ).toLowerCase();

        const placeholder = (
          element.getAttribute("placeholder") || ""
        ).toLowerCase();

        return (
          aria.includes("message") ||
          aria.includes("prompt") ||
          placeholder.includes("message") ||
          placeholder.includes("prompt") ||
          element.tagName === "TEXTAREA"
        );
      })
      .pop() || candidates.filter(visible).pop() || null;
  }

  function setComposerText(element, text) {
    element.focus();

    if (element.tagName === "TEXTAREA") {
      const setter =
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        )?.set;

      if (setter) {
        setter.call(element, text);
      } else {
        element.value = text;
      }
    } else {
      element.textContent = text;
    }

    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );

    element.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );
  }

  function findSendButton() {
    const direct = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[data-testid*="send"]'
    ];

    for (const selector of direct) {
      const button = document.querySelector(selector);

      if (visible(button) && !button.disabled) {
        return button;
      }
    }

    const buttons = [
      ...document.querySelectorAll(
        "button,[role='button']"
      )
    ];

    return buttons
      .filter(visible)
      .filter(button => !button.disabled)
      .find(button => {
        const label = (
          (button.getAttribute("aria-label") || "") +
          " " +
          (button.getAttribute("data-testid") || "") +
          " " +
          (button.innerText || "")
        ).toLowerCase();

        return (
          label.includes("send") &&
          !label.includes("stop") &&
          !label.includes("cancel")
        );
      }) || null;
  }

  function sendWithKeyboard(element) {
    element.focus();

    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
      })
    );
  }

  async function waitForComposer(
    timeout = 15000
  ) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const composer = findComposer();

      if (composer) {
        return composer;
      }

      await new Promise(resolve =>
        setTimeout(resolve, 250)
      );
    }

    return null;
  }

  async function waitForSendButton(
    timeout = 5000
  ) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const button = findSendButton();

      if (button) {
        return button;
      }

      await new Promise(resolve =>
        setTimeout(resolve, 200)
      );
    }

    return null;
  }

  function captureResponse() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-message-author-role="assistant"] .markdown',
      ".markdown"
    ];

    const texts = [];

    for (const selector of selectors) {
      for (
        const element of
        document.querySelectorAll(selector)
      ) {
        if (!visible(element)) continue;

        const text = (
          element.innerText || ""
        ).trim();

        if (text) {
          texts.push(text);
        }
      }
    }

    return [...new Set(texts)].pop() || "";
  }

  chrome.runtime.onMessage.addListener(
    (message, sender, reply) => {

      if (message?.type === "PING_CHATGPT") {
        reply({
          ok: true,
          ready: !!findComposer()
        });

        return;
      }

      if (message?.type === "SEND_PROMPT") {
        (async () => {
          const composer =
            await waitForComposer();

          if (!composer) {
            reply({
              ok: false,
              error:
                "ChatGPT composer was not found."
            });

            return;
          }

          setComposerText(
            composer,
            message.text
          );

          await new Promise(resolve =>
            setTimeout(resolve, 500)
          );

          const sendButton =
            await waitForSendButton();

          if (sendButton) {
            sendButton.click();

            reply({
              ok: true,
              method: "button"
            });

            return;
          }

          sendWithKeyboard(composer);

          await new Promise(resolve =>
            setTimeout(resolve, 300)
          );

          reply({
            ok: true,
            method: "keyboard"
          });
        })();

        return true;
      }

      if (message?.type === "CAPTURE_RESPONSE") {
        reply({
          ok: true,
          text: captureResponse()
        });

        return;
      }
    }
  );
})();
