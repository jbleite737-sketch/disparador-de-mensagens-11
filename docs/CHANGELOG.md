# 1.4.0

- Corrigida leitura de emojis como imagens em legendas com linhas mistas (`texto<div>linha</div>`), linhas vazias, links e parágrafos.
- Comparação tolera apenas normalização Unicode e apresentação de emoji, preservando texto, URLs e quebras de linha.
- Preenchimento mantém input nativo e emite evento de apoio somente se necessário; confere o editor conectado após atualização da interface.
- Suporte a marcador de envio sem ancestral button/role, limitado à prévia de mídia selecionada.
- Diagnóstico de divergência com comprimentos e primeira posição diferente; sem enviar texto incorreto nem registrar conteúdo no diagnóstico.
- Regressão integrada com emoji-imagem, editor/botão recriados, envio automático único e próximo contato após delay.

# 1.3.0

- Corrigida interrupção antes do clique quando o botão ou a imagem são recriados durante a edição da legenda; os elementos atuais são localizados novamente e conferidos.
- Próxima conversa aberta imediatamente após confirmar a mensagem anterior. A autorização de envio aguarda o delay persistido no worker, incluindo a pausa de lote.
- Contagem regressiva informa o próximo envio; o watchdog considera o intervalo de espera.
- Regressões para botão recriado, bloqueio antes do horário permitido e pausa durante o delay.

# 1.2.0

- Foto preparada por colagem no campo da conversa, substituindo a alteração do input de arquivo.
- Preenchimento e conferência da legenda antes de um único clique automático no envio da mídia.
- Reconhecimento de campos de legenda já existentes, mas ocultos antes da colagem.
- Teste de colagem com arquivo e avanço automático para o segundo contato após o intervalo real entre lotes.
- A confirmação de saída mantém o delay e a continuidade da fila; resultados incertos não são reenviados.

# 1.1.0

- Reconhecimento da prévia de foto com imagem, canvas e fundo CSS; suporte aos novos ícones de envio e ao layout dentro de `#main/footer`.
- Novo módulo `whatsapp-dom.js` carregado antes do content script. A seleção parte dos elementos novos da operação, não de qualquer imagem ou botão já existente na conversa.
- Operação única de foto com `media` e `caption`, legenda multiline e emojis, sem segundo envio de texto.
- Até três tentativas automáticas para falhas confirmadas de preparação da foto, com backoff; ao esgotar, registrar erro e continuar a lista.
- Continuidade automática dos lotes; a interface diferencia espera programada de pausa manual.
- Envio incerto, falta de confirmação do destinatário e perda de sessão permanecem interrupções explícitas.
- Testes adicionais de DOM, recuperação e dois lotes consecutivos com intervalo real.
