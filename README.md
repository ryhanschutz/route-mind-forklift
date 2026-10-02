# RouteMind Fork-lift

Simulador web de tráfego e layout industrial para operações de empilhadeiras. É uma aplicação React/Vite estática, pronta para publicação no GitHub Pages.

## Estrutura

```text
src/                 Aplicação React, simulação e componentes
public/images/       Recursos estáticos exibidos pela aplicação
images/              Arquivos-fonte das imagens do projeto
.github/workflows/   Automação de validação e deploy
docs/                Documentação e materiais de validação
```

## Desenvolvimento local

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Validações de entrega:

```bash
npm run lint
npm test
npm run build
npm run preview
```

## Publicação no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` cria e publica automaticamente o conteúdo de `dist/` a cada push para `main`.

No GitHub, abra **Settings → Pages**, em **Build and deployment**, selecione **GitHub Actions**. Depois faça push para `main` ou execute o workflow manualmente na aba **Actions**.

URL esperada: `https://ryhanschutz.github.io/route-mind-forklift/`

O projeto usa caminhos relativos à base do Vite e `HashRouter`, portanto funciona na URL do projeto e após recarregar a página. Não há backend, banco de dados ou segredos necessários para a hospedagem.

## Critérios de publicação

- `npm run lint`, `npm test` e `npm run build` passam.
- O workflow **Deploy to GitHub Pages** conclui com sucesso.
- Na URL pública carregam logo, planta, racks, caminhões, paletes e empilhadeiras.
- A simulação, edição de rotas, indicadores e voz funcionam no navegador.
