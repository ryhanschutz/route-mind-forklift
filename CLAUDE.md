# CLAUDE.md — Diretrizes e Arquitetura do RouteMind Forklift (Tema 7)

Este documento define a arquitetura, estrutura modular, padrões de código e diretrizes visuais para o **RouteMind Forklift**, focado estritamente no **Tema 7: Rastreabilidade Logística Interna, Frota de Empilhadeiras e Layout Fabril** com padrão industrial SCADA.

---

## 🎯 Objetivo do Projeto
Plataforma SCADA industrial de **gestão de tráfego, telemetria e roteamento dinâmico de empilhadeiras e AGVs em plantas industriais fechadas (indoor layouts)**.

### Integração de Imagens e Ativos Específicos:
- ✅ **Racks de Armazenagem Realistas:** Imagem real em alta resolução dos racks industriais com equipamentos empilhados (`/images/rack-weg.png`).
- ✅ **Cargas Dinâmicas / Paletes WEG:**
  - `Palete Industrial com Módulos PLC WEG` (`/images/pallet-plc-weg.png`)
  - `Palete com 6 Motores Azuis WEG` (`/images/pallet-motors-weg.png`)
  - A carga é dinamicamente atrelada aos garfos da empilhadeira 2D no mapa e nos detalhes de telemetria.
- ✅ **Caminhões de Logística Outbound/Inbound:** Imagem aérea real dos caminhões nas docas (`/images/truck-topdown.png`).
- ✅ **Empilhadeira Top-Down com Rotação Angular:** Sprite 2D de alta fidelidade (`/images/forklift-topdown.png`) com vetor de direção corrigido em 180° para apontar os garfos sempre na direção do percurso.
- ✅ **Planta SCADA Minimalista:** Blueprint técnico limpo, sem poluição visual ou fontes genéricas.

---

## 🎨 Design System e Identidade Visual (SCADA Industrial)

### Paleta de Cores Institucional:
* **Base / Piso Industrial:** Branco e off-white refinado com grid técnico sutil (`#FFFFFF`, `#FAFAFC`, `#EDF2F7`).
* **Estrutura / Painéis:** Azul-marinho `#051E4B` (RGB: 5, 30, 75).
* **Alerta / Highway / Destaques:** Amarelo/Dourado `#F49E03` (RGB: 244, 158, 3).
* **Zonas de Segurança / Pedestres:** Verde `#16A34A` e `#DCFCE7`.
* **Obstruções / Paradas Críticas:** Vermelho `#DC2626`.

### Tipografia:
- **Interface e Títulos:** *Plus Jakarta Sans*
- **Telemetria, Coordenadas e Códigos de Máquina:** *JetBrains Mono*

---

## 🏗️ Estrutura Modular da Base de Código

```
src/
├── modules/
│   ├── plant-layout/        # Bloco da Planta Industrial (L.CRS.Simple, SVG SCADA, presets, nós)
│   │   ├── components/      # PlantMapView.tsx (renderizador de mapa e empilhadeiras), PlantControlPanel.tsx
│   │   ├── presets/         # defaultWarehouse.ts (malha com nós de docas, racks WEG e Highway)
│   │   └── types.ts         # Tipagens da planta e zonas
│   ├── fleet/               # Gestão da Frota de Empilhadeiras e AGVs
│   │   ├── hooks/           # usePlantSimulation.ts (hook master de tráfego, A*, baterias e cargas)
│   │   └── types.ts         # Tipagens de veículos e cargas (empty, pallet_plc, pallet_motors)
│   ├── routing/             # Motor de Roteamento e Análise de Tráfego
│   │   ├── engine.ts        # Algoritmo A*, cálculo euclidiano, ângulos angulares de percurso
│   │   └── traffic-analysis.ts # Detecção de gargalos, heatmap e contadores de passagem
│   ├── analytics/           # Indicadores e Dashboard Analítico (Tema 7)
│   │   └── components/      # TrafficAnalyticsDashboard.tsx (Recharts de ocupação e disponibilidade)
│   └── radio-console/       # Comunicação e Telemetria
│       ├── components/      # IndustrialRadioConsole.tsx (Console de rádio com filtros)
│       └── voice.ts         # Alertas sonoros sintetizados por voz
├── pages/
│   └── IndustrialDashboard.tsx # Tela SCADA principal
```

---

## 🚀 Como Rodar o Sistema

```bash
npm run dev
```
Acesse `http://localhost:5173`.
