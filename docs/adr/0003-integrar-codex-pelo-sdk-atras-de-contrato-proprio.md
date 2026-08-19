---
status: accepted
supersedes: ADR-0002
---

# Integrar Codex pelo SDK atrás de um contrato próprio

A demo continuará usando Codex de ponta a ponta, mas o runtime passará a usar `@openai/codex-sdk@0.148.0`, com versão exata e lockfile, atrás do contrato interno `CodexRuntime`; a implementação atual será `LocalCodexSdkRuntime`, substituindo a integração manual com `child_process.spawn`. A decisão se apoia no spike preservado em `spike/codex-sdk` no commit `a153d00` e nas capacidades verificadas do SDK para imagem local, JSON Schema, streaming, cancelamento e busca web; a futura intercambialidade pertence ao nosso contrato, pois o SDK controla um runtime Codex local e não promete compatibilidade direta com uma execução hospedada. Cada perfil iniciará uma thread isolada, tipos e eventos brutos permanecerão no adaptador, e a fronteira padrão usará sandbox `read-only`, aprovação `never`, apps e plugins desativados e rede desligada, exceto pela busca `live` do Precificador; qualquer ampliação futura será mínima, limitada ao perfil que a exige e coberta por teste focado.
