# Validação da versão 1.3.0

- `npm test`: 18 testes passaram, zero falhas. Abrangem CSV/telefones, personalização, limites, exportação, persistência de mídia, rejeição de formatos, tokens da fila, pausa, reinício e resultados incertos.
- `npm run test:browser`: 16 verificações passaram no Chromium. Incluem XLSX real, deduplicação, campos personalizados, rascunho, fluxo de texto, pausa, relatório, destinatário incorreto, lista colada, renderização sem execução de HTML, foto persistida, foto + legenda em um único clique, ausência de exceções e layout estreito.
- `npm run test:dom`: 7 regressões passaram: prévia clássica, prévia dentro de `#main/footer`, canvas, fundo CSS, textarea, editor previamente oculto e rejeição de prévias ambíguas.
- A página de teste usa a política `script-src 'self'; object-src 'none'`, equivalente à restrição de scripts do manifesto. ExcelJS funciona como biblioteca local, sem CDN.
- `npm run package`: ZIPs gerados e reabertos com validação de CRC e verificação dos arquivos obrigatórios do manifesto.
- Teste de dois lotes consecutivos: intervalo mínimo/máximo de 30 segundos, um contato por lote e pausa de 30 segundos. A próxima conversa abriu em menos de 10 segundos, sem clique antecipado; o segundo envio ocorreu automaticamente após pelo menos 60 segundos de relógio real; cada contato recebeu uma operação com arquivo e legenda juntos, sem envio de texto separado.
- Código Python original não executado. Inspeção REA e leitura estática documentadas separadamente.

## Não validado neste ambiente

O Chromium gerenciado bloqueou `Extensions.loadUnpacked` por política administrativa. A política foi preservada. Os testes de navegador exercitam os arquivos reais de UI, background e content script, com fronteiras de APIs Chrome/IndexedDB do worker e WhatsApp simuladas. Isso não comprova o ciclo de vida real de um service worker MV3, nem compatibilidade com todas as versões da interface do WhatsApp.

Nenhuma conta de WhatsApp foi conectada; nenhuma mensagem real foi enviada. Faça a primeira validação no Chrome com um único número seu e uma imagem de teste. Confira destinatário, imagem, legenda e relatório antes de usar uma lista maior. Interrompa a campanha se aparecer um resultado incerto; a extensão não o repetirá automaticamente.

A versão distribuída envia uma foto por campanha, opcionalmente com legenda, ou texto sem foto. Não inclui vídeos, áudios, PDFs ou galerias.

A falha real relatada pelo usuário na 1.0 foi usada para revisar os seletores, mas a conta real do usuário não está acessível neste ambiente. O resultado dos testes simulados não comprova a compatibilidade com todas as versões atuais do WhatsApp Web.

Na versão 1.2, o teste de navegador recebe o arquivo via evento `paste`, confere uma colagem e um clique de envio, a legenda final e a continuidade sem intervenção. O receptor de colagem é simulado: a aceitação de ClipboardEvent sintético pelo WhatsApp real permanece não validada.

A regressão da versão 1.3 recria o botão após o evento de digitação da legenda. O teste exige clique automático único no botão atual. Também verifica o horário mínimo no worker e a invalidação da autorização quando o usuário pausa na próxima conversa. A captura do usuário não fornece o DOM real; essa correção resolve uma condição reproduzida nos testes, mas não confirma a causa exata na conta do usuário.
