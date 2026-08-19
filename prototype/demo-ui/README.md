# Protótipo visual — Foto vira anúncio

> Código descartável para responder: **como um microempreendedor fotografa e publica um produto usando somente uma conversa familiar no celular?**

Uma composição única do fluxo completo numa rota estática de protótipo. A
captura simula uma conversa no estilo WhatsApp, sem integrar com o WhatsApp
real.

## Decisão para o protótipo frontend

A composição escolhida para o protótipo navegável é:

- captura: `A` — conversa direta;
- painel: `C` — esteira do agente;
- loja: `B`.

Este diretório entrega somente HTML, CSS e JavaScript estáticos com dados
simulados em memória no navegador. Ela não implementa backend, APIs, Next.js,
Codex SDK, busca web nem persistência.

As escolhas são referências visuais independentes por superfície. A aplicação
funcional coexiste no repositório e deve receber essas decisões por handoff,
sem importar diretamente o código descartável do protótipo.

## Executar

```bash
python3 prototype/demo-ui/serve.py
```

Abra:

```text
http://127.0.0.1:4173/?surface=captura
```

Superfícies disponíveis:

- `?surface=captura` — conversa direta A;
- `?surface=painel` — esteira do agente C;
- `?surface=loja` — vitrine B.

No celular, o atributo `capture="environment"` pede a câmera traseira; a outra ação abre a galeria. Após escolher a imagem, o fluxo simula catalogação, preço e redação antes de exibir `Publicar anúncio`.

Para testar em outro aparelho na mesma rede, abra `http://IP-DO-NOTEBOOK:4173/?surface=captura`.

O controle flutuante troca entre `captura`, `painel` e `loja`. Os dados são
falsos e vivem apenas em memória. Este código não deve ser promovido
diretamente para produção; as decisões visuais escolhidas devem ser
reimplementadas na aplicação funcional.
