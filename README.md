# Checkout Simplifica — R$ 197,00 no Pix

Checkout responsivo com os banners fornecidos, fonte Hotmart Sans e integração com a [API Black Cat](https://docs.blackcatoficial.com/).

## Executar

Requer Node.js 22 ou superior. Não há dependências para instalar.

1. Copie `.env.example` para `.env`.
2. Configure `BLACKCAT_API_KEY` com a chave da sua conta Black Cat.
3. Configure `CHECKOUT_TOKEN_SECRET` com um segredo aleatório de pelo menos 32 caracteres. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Execute `npm start` (ou `node --env-file-if-exists=.env server.mjs`).
5. Acesse http://localhost:3000.

## Hospedagem

Este repositório contém frontend e servidor. GitHub Pages sozinho não executa a integração de pagamento. Hospede em um serviço com Node.js, configure as duas variáveis secretas no painel e use `npm start`. Para contêineres, defina `HOST=0.0.0.0`. Em produção, use HTTPS e um proxy confiável que informe `X-Forwarded-Proto: https`. Não publique `.env`.

## Pagamento sem banco de dados

- O servidor fixa o preço em **19700 centavos** e usa `POST /sales/create-sale` com `X-API-Key`.
- O QR Code e o copia e cola vêm de `paymentData`; se o provedor não enviar a imagem, o código continua disponível.
- A confirmação usa `GET /sales/{transactionId}/status` a cada 10 segundos enquanto a página está aberta.
- Não há banco, arquivo de transações, localStorage ou armazenamento de dados pessoais. O código Pix fica somente na memória da página. Um cookie assinado e HttpOnly permite consultar a transação por até 24 horas; não contém os dados pessoais do comprador.
- A Black Cat recebe e mantém os dados necessários para processar a transação em seu próprio sistema.
- Atualizar/fechar a página perde o código exibido. Não há recuperação persistente de cobranças nem garantia de idempotência em falhas de rede; o frontend bloqueia cliques repetidos enquanto cria uma cobrança e após recebê-la.
- Limitação básica de criação por IP usa somente contadores temporários em memória do processo; configure proteção adicional na hospedagem se usar múltiplas instâncias. Configure o proxy de forma apropriada, pois o endereço usado é o da conexão direta.
- Este projeto não entrega o curso e não envia emails de acesso. A entrega deve ser configurada na plataforma de cursos ou no fluxo do vendedor. A interface confirma apenas o pagamento.
- Sem credenciais, a API retorna indisponibilidade: nenhuma cobrança fictícia é apresentada como real.

## Verificação

`npm test` testa preço fixo, documentos, validações, assinatura/expiração da sessão e o fluxo HTTP com respostas simuladas do provedor. Nenhum teste cria cobrança real. Em ambientes que impedem subprocessos, use `node --test --test-isolation=none`.

## Arquivos visuais

As cinco imagens de `public/assets` foram fornecidas pelo usuário. Hotmart Sans regular e bold foram obtidas dos endereços oficiais declarados em https://hotmart.com/pt-br, em `https://static.hotmart.com/fonts/v1/hotmart-sans/`. A pilha CSS é `"Hotmart Sans",Arial,Helvetica,sans-serif`.
