# TOP Usinagem

Sistema interno de clientes e orçamentos, feito com Next.js, TypeScript e Supabase. A interface segue o protótipo aprovado em `ui-prototype.html`.

## Recursos

- Acesso somente por convite do Supabase Auth
- Clientes, múltiplos e-mails e ativação/inativação
- Rascunhos, itens, condições comerciais e numeração sequencial por ano
- Finalização, PDF privado no Supabase Storage, e log de entrega
- Envio SMTP compatível com a conta Terra

## Configuração

1. Copie `.env.example` para `.env.local` e preencha as credenciais.
2. Aplique, na ordem, todos os arquivos de `supabase/migrations/` (0001, 0002, 0003, 0004...) no Supabase SQL Editor.
3. No Supabase Auth, convide os usuários que terão acesso.
4. Preencha as credenciais SMTP da Terra. Sem elas, o PDF é gerado, mas o orçamento fica como `Falha no envio` e o motivo aparece no histórico.
5. Execute `npm.cmd run dev`.

## Variáveis de ambiente

Consulte `.env.example`. O sistema não precisa da chave secreta do Supabase: os PDFs são guardados com a sessão do usuário logado, protegidos pelas políticas do bucket privado. O envio de e-mail só acontece com `EMAIL_SENDING_ENABLED=true`.
