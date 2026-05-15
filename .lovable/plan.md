## Situação

Esse ajuste já foi aplicado no turno anterior em `src/pages/Categories.tsx` (mutação `deleteMutation`). A mensagem fixa enganosa ("Não é possível excluir categorias com transações associadas") foi substituída pela mensagem real do erro retornado pelo banco.

Comportamento atual:
- Sucesso: toast "Categoria excluída com sucesso!" e o `ConfirmDialog` já avisa antes que "Transações associadas ficarão sem categoria."
- Falha real (rede/RLS/etc.): toast "Erro ao excluir categoria" com a descrição vinda de `error.message`.

Como não há FK entre `transactions.category_id` e `categories.id`, a exclusão sempre sucede e as transações ficam com `category_id = null` (já tratado nas telas como "Sem categoria").

## Plano

Nenhuma alteração de código necessária — a correção solicitada já está em produção no preview.

Se quiser ir além, posso (opcionalmente, em outra rodada):
1. Adicionar FK `transactions.category_id → categories.id ON DELETE SET NULL` para garantir o comportamento no banco, não só na UI.
2. Mostrar no `ConfirmDialog` quantas transações serão desassociadas antes de confirmar.

Quer seguir com algum desses dois itens?
