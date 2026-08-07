(() => {
  function visible(el) {
    if (!el) return false;

    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);

    return (
      r.width > 100 &&
      r.height > 20 &&
      s.display !== "none" &&
      s.visibility !== "hidden"
    );
  }

  function findComposer() {
    const candidates = [
      ...document.querySelectorAll("textarea"),
      ...document.querySelectorAll(
        'div[contenteditable="true"][role="textbox"]'
      ),
      ...document.querySelectorAll(
        'div[contenteditable="true"]'
      )
    ];

    return candidates.filter(visible).pop() || null;
  }

  function setText(el, text) {
    el.focus();

    if (el.tagName === "TEXTAREA") {
      const setter =
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        )?.set;

      if (setter) setter.call(el, text);
      else el.value = text;
    } else {
      el.textContent = text;
    }

    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );

    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSendButton() {
    return [
      ...document.querySelectorAll("button,[role='button']")
    ].find(button => {
      if (!visible(button)) return false;

      const text = (
        (button.getAttribute("aria-label") || "") +
        " " +
        (button.innerText || "")
      ).toLowerCase();

      return /send|submit/.test(text) && !/stop/.test(text);
    });
  }

  function clickSend() {
    const button = findSendButton();

    if (!button) return false;

    button.click();
    return true;
  }

  function captureResponse() {
    const nodes = [
      ...document.querySelectorAll(
        '[data-message-author-role="assistant"]'
      ),
      ...document.querySelectorAll(".markdown")
    ];

    const texts = nodes
      .filter(visible)
      .map(e => (e.innerText || "").trim())
      .filter(Boolean);

    return [...new Set(texts)].pop() || "";
  }

  async function waitForComposer(timeout = 10000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const composer = findComposer();

      if (composer) return composer;

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg?.type === "PING_CHATGPT") {
      reply({
        ok: true,
        ready: !!findComposer()
      });
      return;
    }

    if (msg?.type === "SEND_PROMPT") {
      (async () => {
        const composer = await waitForComposer();

        if (!composer) {
          reply({
            ok: false,
            error: "ChatGPT composer did not become ready."
          });
          return;
        }

        setText(composer, msg.text);

        await new Promise(resolve => setTimeout(resolve, 300));

        if (!clickSend()) {
          reply({
            ok: false,
            error: "ChatGPT send button was not available."
          });
          return;
        }

        reply({
          ok: true
        });
      })();

      return true;
    }

    if (msg?.type === "CAPTURE_RESPONSE") {
      reply({
        ok: true,
        text: captureResponse()
      });
    }
  });
})();
