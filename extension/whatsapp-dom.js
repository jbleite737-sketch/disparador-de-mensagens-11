// Loaded before content.js in the extension's isolated world. No WhatsApp internals.
(() => {
  const visible = element => {
    if (!element?.isConnected || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };
  const editorSelector = '[contenteditable="true"],textarea';
  const normalize = value => String(value || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200b\u200e\u200f]/g, '').trim();
  // Read editable structure rather than appending a newline to every nested block.
  // In Chromium, inserted multiline text often becomes: first line<div>next line</div>.
  const blockTags = new Set(['DIV','P','LI','UL','OL','BLOCKQUOTE']);
  function readNodes(element) {
    let result='', previousBlock=false, seen=false;
    const children=[...element.childNodes];
    for (let index=0;index<children.length;index++) {
      const node=children[index];
      if(node.nodeType===Node.TEXT_NODE){
        if(!node.nodeValue)continue;
        if(previousBlock)result+='\n';
        result+=node.nodeValue;previousBlock=false;seen=true;continue;
      }
      if(node.nodeType!==Node.ELEMENT_NODE)continue;
      if(node.matches('script,style'))continue;
      const block=blockTags.has(node.tagName);
      if(seen&&(block||previousBlock))result+='\n';
      if(node.tagName==='IMG')result+=node.getAttribute('data-plain-text')||node.getAttribute('alt')||'';
      else if(node.tagName==='BR'){
        // A final BR inside a block is the editor's empty-line/caret placeholder.
        if(index!==children.length-1||!blockTags.has(element.tagName))result+='\n';
      }else result+=readNodes(node);
      previousBlock=block;seen=true;
    }
    return result;
  }
  const text = element => normalize(element instanceof HTMLTextAreaElement?element.value:readNodes(element));
  // Emoji presentation selectors may be omitted by WhatsApp's emoji renderer.
  // Preserve line breaks, URLs, ZWJ sequences, skin tones and actual content.
  const comparable = value => normalize(value).normalize('NFC').replace(/[\ufe0e\ufe0f]/g,'');
  // Requested policy: nonempty caption is sufficient; photo-only jobs stay supported.
  const captionReady = (element,caption) => normalize(caption)?text(element).length>0:text(element).length===0;
  function sendButtons(root = document, {allowDisabled=false} = {}) {
    const candidates = new Set();
    for (const icon of root.querySelectorAll('[data-icon="send"],[data-icon="wds-ic-send-filled"],[data-icon="send-filled"],[data-icon="send-alt"],[data-testid="send"]')) {
      const button = icon.closest('button,[role="button"],[data-testid="send"]') || icon;
      if (button) candidates.add(button);
    }
    for (const button of root.querySelectorAll('button[aria-label],[role="button"][aria-label],button[title],[role="button"][title]')) {
      if (/^(enviar|send)(\s+(foto|photo|image|imagem|media|mídia))?$/i.test(button.getAttribute('aria-label') || button.title || '')) candidates.add(button);
    }
    return [...candidates].filter(b => visible(b) && (allowDisabled || (!b.disabled && b.getAttribute('aria-disabled') !== 'true')));
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
      editors: new Set([...document.querySelectorAll(editorSelector)].filter(visible)),
      buttons: new Set(sendButtons(document,{allowDisabled:true})),
      media: new Map(mediaNodes().map(e => [e, signature(e)])),
    };
  }
  function preview(before, {allowDisabled=false} = {}) {
    const editors = [...document.querySelectorAll(editorSelector)].filter(e => visible(e) && !before.editors.has(e));
    const images = mediaNodes().filter(e => !e.closest('.message-out,.message-in') && (!before.media.has(e) || before.media.get(e) !== signature(e)));
    const buttons = sendButtons(document,{allowDisabled}).filter(e => !before.buttons.has(e));
    const matches = [];
    for (const button of buttons) {
      // Stop at the smallest common container, including a preview inside #main/footer.
      for (let scope = button.parentElement; scope && scope !== document.body && scope !== document.documentElement; scope = scope.parentElement) {
        const candidates = editors.filter(e => scope.contains(e) && !e.disabled && !e.readOnly);
        const marked = candidates.filter(e => e.closest('[data-testid="media-caption-input-container"]'));
        const captions = marked.length ? marked : candidates;
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
  async function setCaption(editor, caption, resolveEditor = () => editor) {
    if (text(editor)) throw Error('A prévia já tem uma legenda. Confira a conversa antes de retomar.');
    // Retry only preparation on an empty editor. A nonempty caption is never appended to.
    for(let attempt=0;attempt<3;attempt++){
      let current=resolveEditor();
      if(current?.isConnected&&captionReady(current,caption))return current;
      if(current?.isConnected&&caption){
        current.focus();await Promise.resolve();
        // Focusing can replace the DOM node. Reacquire before selecting/inserting.
        current=resolveEditor();
        if(current?.isConnected&&!text(current)){
          current.focus();
          if(current instanceof HTMLTextAreaElement){
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(current,caption);
            current.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:caption}));
          }else if(current.isConnected){
            const range=document.createRange();range.selectNodeContents(current);
            const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
            let inputObserved=false;const observe=()=>{inputObserved=true;};
            current.addEventListener('input',observe,{capture:true});
            let inserted=false;
            try{inserted=document.execCommand('insertText',false,caption);}finally{current.removeEventListener('input',observe,{capture:true});}
            if(inserted&&!inputObserved)current.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:caption}));
            if(!inserted&&current.isConnected&&!text(current)){
              const transfer=new DataTransfer();transfer.setData('text/plain',caption);
              current.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:transfer}));
            }
          }
        }
      }
      const deadline=Date.now()+1000,readyAfter=Date.now()+350;
      do{
        await new Promise(resolve=>setTimeout(resolve,150));current=resolveEditor();
        if(Date.now()>=readyAfter&&current?.isConnected&&captionReady(current,caption))return current;
      }while(Date.now()<deadline);
    }
    throw Object.assign(Error('A caixa de legenda permaneceu vazia ou indisponível após três tentativas de preenchimento. Nenhum envio acionado.'),{code:'CAPTION_EMPTY'});
  }
  function diagnostics(before) {
    return `editores novos=${[...document.querySelectorAll(editorSelector)].filter(e => visible(e) && !before.editors.has(e)).length}; prévias visuais=${mediaNodes().filter(e => !before.media.has(e)).length}; botões de envio=${sendButtons().length}`;
  }
  globalThis.ContatoWhatsAppDOM = {visible, normalize, text, sendButtons, mediaNodes, snapshot, preview, photoInput, setCaption, diagnostics, signature, comparable, captionReady};
})();
