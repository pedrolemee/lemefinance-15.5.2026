## Problema

Hoje a aba **Previsões** trata uma compra no crédito feita hoje como uma "despesa passada". Pior: ela entra na média de despesas variáveis dos últimos 3 meses e é replicada em **todos** os meses futuros do horizonte. Foi por isso que seu PIX de R$ 50 (e qualquer compra no crédito) apareceu somando em Jun/2026, Jul/2026, Ago/2026… até Mai/2027.

O que você espera é o comportamento real do cartão: **gastei agora, pago mês que vem** — então a despesa precisa aparecer como compromisso da próxima fatura, e **não** ser distribuída como variável recorrente.

## Decisão de modelagem (sem configuração extra)

Para não te obrigar a cadastrar dia de fechamento por banco agora, vou adotar a regra mais simples:

- **Toda transação com `payment_method = 'credit_card'` é deslocada para o mês seguinte** ao da data da compra (e tratada como compromisso da fatura, igual a uma parcela).
- Vale para compras à vista no crédito (1x). **Parcelas (>1x)** continuam como estão hoje, porque cada parcela já tem sua própria data lançada no banco — o que costuma já refletir o mês da fatura.
- No futuro, se você quiser, dá pra evoluir para "dia de fechamento por banco".

## Mudanças na aba Previsões

1. **Compromissos futuros (`futureTx`)**
   Hoje só entram transações com `date > hoje`. Vou expandir para também incluir:
   - Compras no crédito de 1x feitas até hoje cuja **data + 1 mês** caia dentro do horizonte de previsão.
   - Cada uma é alocada no mês da fatura (mês seguinte ao da compra) como `committedExpenses`, aparecendo também na lista de compromissos.

2. **Cálculo da média de despesas variáveis (`categoryAverages`)**
   Vou **excluir do histórico** todas as transações com `payment_method = 'credit_card'` (à vista ou parceladas). Motivo: elas já estão sendo contabilizadas como compromisso de fatura — incluí-las na média causaria a duplicação atual.
   - Outras formas de pagamento (PIX, débito, dinheiro, boleto) continuam entrando na média como hoje.

3. **Saldo atual (`fullBalance`)**
   O saldo "hoje" continua somando todas as transações com `date <= hoje`, **incluindo** as do crédito (você gastou de fato; a fatura é só quando sai do banco). Isso preserva o comportamento das outras telas (Dashboard, Bancos) e evita inconsistência. A consequência é: o saldo já reflete o gasto, e a fatura aparece de novo no mês seguinte como compromisso — exatamente o que você quer ver na previsão ("vou precisar pagar isso").

4. **Lista de compromissos futuros (`FutureCommitments`)**
   Cada fatura de crédito deslocada aparece com a descrição original e um indicador de que é fatura do crédito (badge "Crédito" ou similar), para diferenciar de parcelas e recorrentes.

## Observação sobre o seu caso atual

Sua transação do PIX **não** é cartão de crédito (`payment_method = 'pix'`), então ela continuará entrando na média variável. O problema do "R$ 50 em todos os meses" para o PIX é separado e tem a ver com histórico curto (1 mês cobre o cálculo). Posso resolver isso em outra rodada com a opção 4 que sugeri antes (ignorar mês corrente + exigir histórico mínimo), se você quiser. Esta rodada foca só no cartão de crédito, como você pediu.

## Arquivos afetados

- `src/hooks/useForecast.ts` — toda a lógica acima
- `src/components/FutureCommitments.tsx` — badge/label "Fatura crédito" no item

Sem mudanças em banco, sem mudanças nas outras telas.
