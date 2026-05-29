# SatGuard — Previsão Climática e Prevenção de Desastres

> **Global Solution 2026.1 — FIAP**  
> Disciplina: Mobile Development & IoT

---

## Sobre o Projeto

O **SatGuard** é um aplicativo mobile desenvolvido em React Native + Expo como parte da **Global Solution 2026.1** da FIAP. O projeto integra tecnologia espacial e dados climáticos para oferecer uma solução de **monitoramento, previsão e prevenção de desastres naturais** no Brasil.

O app funciona como **dashboard central** do ecossistema da Global Solution, conectando dados simulados de satélite (Sentinel-2, INPE, NASA FIRMS) a uma interface mobile que permite a operadores cadastrarem regiões de risco, acompanharem alertas em tempo real e analisarem a distribuição climática por tipo de desastre.

### Tema Espacial

**Previsão Climática e Prevenção de Desastres com Dados Espaciais**

Satélites como o Sentinel-2 (ESA) e as redes da NASA permitem detectar padrões climáticos, variações de temperatura, umidade do solo e focos de incêndio com antecedência. O SatGuard simula o consumo desses dados para alertar sobre:

- Enchentes e alagamentos
- Secas e estiagens prolongadas
- Queimadas e incêndios florestais
- Tempestades e vendavais
- Situações de risco múltiplo

---

## Tecnologias

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework mobile | React Native | 0.83.2 |
| Plataforma de desenvolvimento | Expo | 55.0.9 |
| Roteamento | Expo Router | 55.0.8 |
| UI | React | 19.2.0 |
| Armazenamento local | AsyncStorage | 2.2.0 |
| Notificações | Expo Notifications | 55.0.22 |
| Gráficos | React Native Chart Kit | 6.12.0 |
| API mock | json-server | 0.17.4 |
| TLS (servidor) | selfsigned | 5.5.0 |
| Detecção de rede | expo-network | 55.0.9 |

---

## Funcionalidades

### Autenticação e Segurança
- Login com e-mail e senha
- Proteção contra força bruta (5 tentativas → bloqueio de 15 min)
- Hashing de senha com DJB2 (1000 rounds + salt derivado do e-mail)
- Sessão com TTL de 8 horas e renovação automática
- Criptografia XOR para dados em repouso (AsyncStorage)
- Assinatura HMAC em requisições POST/PUT/PATCH
- Auditoria estruturada em ring buffer (200 entradas)

### Controle de Acesso (RBAC)

| Papel | Permissões | Como obter |
|-------|-----------|------------|
| **Admin** | Todas as funções | Login `a` / `a` ou código `admin` no cadastro |
| **Analista** | Dashboard + Cadastro + Alertas | E-mail `@satguard.com` |
| **Usuário** | Cadastro + Alertas | Qualquer outro e-mail |

### Telas do Aplicativo

#### Login
- Campo de estrelas gerado deterministicamente (70 estrelas)
- Anel de órbita pontilhado ao redor do logo
- Validação com feedback visual via toast animado

#### Menu Principal
- Lista vertical de cards com ícone, título e subtítulo
- Card do operador com avatar, nome e pílula de papel colorida
- Indicador "LIVE" de sistema ativo
- Card "Monitoramento" bloqueado para usuários sem permissão

#### Registrar Área
- Indicador de etapas visuais (Etapa 1: Localização → Etapa 2: Parâmetros)
- Dropdown com os 27 estados brasileiros + busca
- Tipo de risco: Enchente, Seca, Queimada, Tempestade, Múltiplos
- Nível de risco: Baixo, Médio, Alto, Crítico
- Área em km² e descrição opcional
- Envio para API local (`POST /regioes`)
- Notificação push ao cadastrar com sucesso

#### Monitoramento (Dashboard)
- **KPI hero**: total de regiões monitoradas em destaque
- KPIs secundários: regiões críticas + estados cobertos
- Gráfico de barras com distribuição por tipo de risco
- Top 3 regiões mais críticas (restrito a Analistas e Admins)
- Tabela completa: UF, Região, Tipo, Risco, Área (km²)
- Indicador de fonte de dados: API local ou db.json embutido
- Suporte offline com fallback em 3 camadas (API → Cache → db.json)

#### Alertas Climáticos
- Cards com faixa lateral colorida por severidade
- Chip de severidade compacto no canto do card
- Meta: data prevista + fonte de dados na mesma linha
- Escala de severidade: Baixo (azul) → Médio (laranja) → Alto (laranja-verm.) → Crítico (vermelho)
- Notificação push imediata para alertas Críticos
- Notificação 1 dia antes para alertas de outras severidades
- Histórico filtrado: Resolvidos / Descartados

---

## Estrutura do Projeto

```
fiap-mdi-sprint-ford_service_analytics-main/
├── app/
│   ├── _layout.js          # Layout raiz, notificações, retenção de dados
│   ├── index.js            # Tela de login com campo de estrelas
│   ├── menu.js             # Menu principal (cards verticais)
│   ├── nova-conta.js       # Cadastro de novo usuário
│   ├── cadastro.js         # Registro de região monitorada
│   ├── registros.js        # Dashboard de monitoramento climático
│   ├── alertas.js          # Gerenciamento de alertas climáticos
│   └── utils/
│       ├── auth.js         # Sessão com TTL e renovação automática
│       ├── rbac.js         # Controle de acesso por papel
│       ├── security.js     # Sanitização, validação, assinatura HMAC
│       ├── crypto.js       # Hash DJB2, criptografia XOR
│       ├── bruteForce.js   # Bloqueio por tentativas repetidas
│       ├── rateLimiter.js  # Rate limiting por janela deslizante
│       ├── logger.js       # Auditoria estruturada com ring buffer
│       └── retention.js    # Limpeza automática de dados expirados
├── db.json                 # Banco de dados mock (12 regiões brasileiras)
├── server.js               # API local (json-server + TLS + segurança)
├── app.json                # Configuração Expo (nome: SatGuard)
└── package.json
```

---

## Banco de Dados Mock (`db.json`)

12 regiões brasileiras pré-cadastradas, cobrindo os principais tipos de risco:

| Região | Estado | Tipo | Risco |
|--------|--------|------|-------|
| Vale do Paraíba | SP | Enchente | Crítico |
| Sertão Nordestino | CE | Seca | Crítico |
| Baixada Fluminense | RJ | Enchente | Crítico |
| Vale do Itajaí | SC | Enchente | Crítico |
| Região Metropolitana de Recife | PE | Enchente | Alto |
| Norte do Pantanal | MT | Queimada | Alto |
| Sul do Amazonas | AM | Queimada | Alto |
| Litoral Norte de SC | SC | Múltiplos | Alto |
| Cariri Paraibano | PB | Seca | Alto |
| Serra Gaúcha | RS | Tempestade | Médio |
| Grande ABC Paulista | SP | Tempestade | Médio |
| Chapada Diamantina | BA | Seca | Médio |

---

## API Local

O servidor mock (`server.js`) expõe endpoints REST via HTTP (porta 3000) e HTTPS (porta 3443).

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/regioes` | Lista todas as regiões monitoradas |
| `POST` | `/regioes` | Cadastra nova região |
| `GET` | `/regioes/:id` | Detalhe de uma região específica |

### Segurança do Servidor

- CORS restrito a origens locais autorizadas
- Rate limiting por IP: GET 60/min · POST 20/min · DELETE 10/min
- Verificação de assinatura HMAC em toda escrita
- Limite de payload: 10kb (prevenção de flooding)
- Headers: HSTS, X-Frame-Options, X-Content-Type-Options
- Detector de anomalias: sinaliza IPs com ≥ 3 violações em 60s
- TLS auto-assinado gerado no primeiro start (armazenado em `.certs/`)

---

## Como Executar

### Pré-requisitos

- Node.js 18+
- Expo Go instalado no dispositivo (ou emulador)

### Instalação

```bash
cd fiap-mdi-sprint-ford_service_analytics-main
npm install
```

### 1. Iniciar a API local

```bash
npm run server
```

Sobe em `http://localhost:3000` (dev) e `https://localhost:3443` (TLS).

### 2. Iniciar o app

```bash
npx expo start
```

Com cache limpo (recomendado após atualizações):

```bash
npx expo start --clear
```

### Credenciais de demonstração

| Papel | E-mail | Senha |
|-------|--------|-------|
| Admin (acesso total) | `a` | `a` |

Para criar outros usuários, acesse "Criar Conta" na tela de login:
- E-mail `@satguard.com` → papel **Analista** (acesso ao Dashboard)
- Qualquer outro e-mail → papel **Usuário**

---

## Estratégia de Dados — Fallback em 3 Camadas

O Dashboard funciona mesmo sem o servidor rodando:

```
1. API local (localhost:3000/regioes)   →  dados em tempo real
         ↓ indisponível
2. Cache AsyncStorage (criptografado)   →  último estado salvo
         ↓ vazio
3. db.json embutido no bundle           →  dados sempre disponíveis
```

O indicador no topo do dashboard (ponto verde/amarelo) mostra qual camada está ativa.

---

## Identidade Visual — Tema Galáxia

| Elemento | Cor | Significado |
|----------|-----|-------------|
| Fundo | `#07000F` | Espaço profundo |
| Cards | `#120028` | Nebulosa escura |
| Acento roxo | `#B478F0` | Nebulosa violeta |
| Botões | `#7B2FBE` | Roxo profundo |
| Texto secundário | `#CCAAFF` | Lilás estelar |
| Crítico | `#F87171` | Vermelho estelar |
| Sucesso / Ativo | `#4ADE80` | Verde sinal |
| Badge Admin | `#F43F5E` | Rosa-vermelho |
| Badge Analista | `#A855F7` | Roxo vivo |
| Badge Usuário | `#818CF8` | Índigo suave |

---

## Fontes de Dados Simuladas

| Fonte | Tipo de dado | Uso no app |
|-------|-------------|-----------|
| **Sentinel-2 (ESA)** | Imagens multiespectrais | Classificação de risco por região |
| **INPE** | Focos de calor, desmatamento | Queimadas e alertas florestais |
| **NASA FIRMS** | Fire Information for Resource Mgmt | Incêndios ativos em tempo real |

Os dados são **simulados** via `db.json` para fins de demonstração acadêmica. Em produção, seriam consumidos via APIs públicas com autenticação.

---

## Equipe

Desenvolvido para a disciplina **Mobile Development & IoT**  
**Global Solution 2026.1 — FIAP**  
Faculdade de Informática e Administração Paulista
