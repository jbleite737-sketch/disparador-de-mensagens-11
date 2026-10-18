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
