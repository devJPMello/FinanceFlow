# FinanceFlow 💰

Plataforma profissional de gestão financeira pessoal desenvolvida com arquitetura moderna e boas práticas de mercado.

## 🏗️ Arquitetura

### Backend
- **Framework**: NestJS
- **ORM**: Prisma
- **Banco de Dados**: PostgreSQL (NeonDB)
- **Autenticação**: JWT
- **Validação**: class-validator

### Frontend
- **Framework**: React 18
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Gerenciamento de Estado**: Zustand
- **Gráficos**: Recharts

## 📁 Estrutura do Projeto

```
FinanceFlow/
├── backend/          # API NestJS
├── frontend/         # Aplicação React
└── README.md
```

## 🚀 Como Executar

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔐 Variáveis de Ambiente

### Backend (.env)
```
DATABASE_URL="postgresql://..."
JWT_SECRET="seu-jwt-secret"
JWT_EXPIRES_IN="7d"
PORT=3000
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
```

## 📋 Funcionalidades

- ✅ Autenticação e autorização JWT
- ✅ CRUD de transações financeiras
- ✅ CRUD de categorias personalizadas
- ✅ Dashboard com gráficos e métricas
- ✅ Metas financeiras com acompanhamento
- ✅ Relatórios e exportação de dados
- ✅ Histórico completo de movimentações

## 🎯 Regras de Negócio

- Transações não podem ter valor zero ou negativo
- Categorias não podem ser removidas se houver transações vinculadas
- Metas devem ter data futura válida
- Isolamento completo de dados por usuário
- Tipo da transação deve corresponder ao tipo da categoria

## 📖 Documentação

- Veja os arquivos `.env.example` para configuração de variáveis de ambiente
- Use os scripts `setup-env.sh` ou `setup-env.bat` para configurar automaticamente

## 🛠️ Tecnologias Utilizadas

### Backend
- **NestJS** - Framework Node.js progressivo
- **Prisma** - ORM moderno e type-safe
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação stateless
- **bcrypt** - Hash de senhas
- **class-validator** - Validação de DTOs

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool moderna
- **Tailwind CSS** - Framework CSS utility-first
- **Zustand** - Gerenciamento de estado leve
- **React Router** - Roteamento
- **Recharts** - Gráficos e visualizações
- **Axios** - Cliente HTTP
- **React Hot Toast** - Notificações

## 📊 Estrutura de Pastas

### Backend
```
backend/
├── src/
│   ├── auth/           # Módulo de autenticação
│   ├── users/           # Módulo de usuários
│   ├── transactions/   # Módulo de transações
│   ├── categories/      # Módulo de categorias
│   ├── goals/           # Módulo de metas
│   ├── dashboard/       # Módulo de dashboard
│   ├── prisma/          # Serviço Prisma
│   └── common/          # Utilitários compartilhados
├── prisma/
│   └── schema.prisma    # Schema do banco de dados
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── components/      # Componentes reutilizáveis
│   ├── pages/           # Páginas da aplicação
│   ├── store/           # Estado global (Zustand)
│   ├── lib/             # Utilitários e configurações
│   ├── types/           # Definições TypeScript
│   └── utils/           # Funções auxiliares
└── package.json
```

## 🔒 Segurança

- Senhas hasheadas com bcrypt (10 rounds)
- Tokens JWT com expiração configurável
- Validação de dados em todas as rotas
- Isolamento de dados por usuário
- CORS configurado
- Validação de entrada com class-validator

## 🚀 Deploy

### Backend (Railway/Render)
1. Conecte o repositório
2. Configure variáveis de ambiente
3. Build: `npm run build`
4. Start: `npm run start:prod`

### Frontend (Vercel)
1. Conecte o repositório
2. Build: `npm run build`
3. Output: `dist`
4. Configure `VITE_API_URL`

## 📝 Licença

Este projeto foi desenvolvido para portfólio profissional.

## 👨‍💻 Autor
DevJPMello

Desenvolvido seguindo padrões profissionais de mercado, com foco em:
- Arquitetura limpa e escalável
- Boas práticas de desenvolvimento
- Segurança e validação de dados
- Experiência do usuário
