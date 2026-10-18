// Loaded before content.js in the extension's isolated world. No WhatsApp internals.
(() => {
  const visible = element => {
    if (!element?.isConnected || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };
  const editorSelector = '[contenteditable="true"],textarea';
  const normalize = value => String(value || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200b\u200e\u200f]/g, '').trim();
  const text = element => {
    if (element instanceof HTMLTextAreaElement) return normalize(element.value);
    // WhatsApp may render emoji as images instead of literal text nodes.
    const copy = element.cloneNode(true);
    for (const image of copy.querySelectorAll('img[alt]')) image.replaceWith(document.createTextNode(image.alt));
    for (const br of copy.querySelectorAll('br')) br.replaceWith(document.createTextNode('\n'));
    // innerText of the actual node preserves contenteditable block line breaks.
    if (!element.querySelector('img[alt]')) return normalize(element.innerText);
    for (const block of copy.querySelectorAll('div,p')) block.append(document.createTextNode('\n'));
    return normalize(copy.textContent);
  };
  function sendButtons(root = document) {
    const candidates = new Set();
    for (const icon of root.querySelectorAll('[data-icon="send"],[data-icon="wds-ic-send-filled"],[data-icon="send-filled"],[data-testid="send"]')) {
      const button = icon.closest('button,[role="button"]');
      if (button) candidates.add(button);
    }
    for (const button of root.querySelectorAll('button[aria-label],[role="button"][aria-label],button[title],[role="button"][title]')) {
      if (/^(enviar|send)(\s+(foto|photo|image|imagem|media|mídia))?$/i.test(button.getAttribute('aria-label') || button.title || '')) candidates.add(button);
    }
    return [...candidates].filter(b => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
  }
  function mediaNodes(root = document) {
    return [...root.querySelectorAll('img,canvas,[style*="background-image"]')].filter(element => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < 64 || rect.height < 64) return false;
      if (element.tagName === 'CANVAS') return element.width > 0 && element.height > 0;
      if (element.tagName === 'IMG') return !!element.getAttribute('src') && element.complete && element.naturalWidth > 0;
      return /url\(/.test(getComputedStyle(element).backgroundImage);
    });
  }
  const signature = element => element.getAttribute('src') || element.getAttribute('style') || `${element.width}x${element.height}`;
  function snapshot() {
    return {
      editors: new Set(document.querySelectorAll(editorSelector)),
      buttons: new Set(sendButtons()),
      media: new Map(mediaNodes().map(e => [e, signature(e)])),
    };
  }
  function preview(before) {
    const editors = [...document.querySelectorAll(editorSelector)].filter(e => visible(e) && !before.editors.has(e));
    const images = mediaNodes().filter(e => !e.closest('.message-out,.message-in') && (!before.media.has(e) || before.media.get(e) !== signature(e)));
    const buttons = sendButtons().filter(e => !before.buttons.has(e));
    const matches = [];
    for (const button of buttons) {
      // Stop at the smallest common container, including a preview inside #main/footer.
      for (let scope = button.parentElement; scope && scope !== document.body && scope !== document.documentElement; scope = scope.parentElement) {
        const captions = editors.filter(e => scope.contains(e));
        const media = images.filter(e => scope.contains(e));
        if (captions.length === 1 && media.length && buttons.filter(e => scope.contains(e)).length === 1) {
          matches.push({button, caption: captions[0], image: media[0], scope});
          break;
        }
      }
    }
    // Never guess between multiple previews/send actions.
    return matches.length === 1 ? matches[0] : null;
  }
  function photoInput() {
    return [...document.querySelectorAll('input[type="file"]')]
      .filter(e => !e.disabled && !e.hasAttribute('capture') && /image\//i.test(e.accept))
      .sort((a, b) => Number(/video\//i.test(b.accept)) - Number(/video\//i.test(a.accept)))[0];
  }
  async function setCaption(editor, caption) {
    if (text(editor)) throw Error('A prévia já tem uma legenda. Confira a conversa antes de retomar.');
    if (caption) {
      editor.focus();
      if (editor instanceof HTMLTextAreaElement) {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, caption);
        editor.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: caption}));
      } else {
        const range = document.createRange();range.selectNodeContents(editor);
        const selection = getSelection();selection.removeAllRanges();selection.addRange(range);
        if (!document.execCommand('insertText', false, caption)) throw Error('Não foi possível preencher a legenda.');
      }
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    if (text(editor) !== normalize(caption)) throw Error('A legenda não corresponde ao texto personalizado.');
  }
  function diagnostics(before) {
    return `editores novos=${[...document.querySelectorAll(editorSelector)].filter(e => visible(e) && !before.editors.has(e)).length}; prévias visuais=${mediaNodes().filter(e => !before.media.has(e)).length}; botões de envio=${sendButtons().length}`;
  }
  globalThis.ContatoWhatsAppDOM = {visible, normalize, text, sendButtons, mediaNodes, snapshot, preview, photoInput, setCaption, diagnostics};
})();
