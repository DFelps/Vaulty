# Vaulty

Vaulty é um gerenciador de senhas e itens seguros local, desenvolvido com Electron + Vue.

Todos os dados ficam no dispositivo do usuário, protegidos por chave mestra e criptografia local.

## Stack

- Electron
- Vue 3
- Vite
- better-sqlite3
- Node.js Crypto API

## Recursos atuais

- criação de cofre local
- desbloqueio com chave mestra
- criptografia local de dados sensíveis
- sessão com bloqueio automático por inatividade
- cadastro de itens do tipo:
  - senha
  - texto seguro
  - arquivo protegido
- CRUD de itens
- busca por texto
- filtro por categoria
- gerador de senha forte
- exportação de backup criptografado
- importação de backup criptografado
- build desktop com electron-builder

## Segurança

- chave mestra não é armazenada em texto puro
- dados sensíveis permanecem criptografados em disco
- itens só ficam acessíveis durante a sessão desbloqueada
- listagem não expõe senha em texto claro
- bloqueio automático após inatividade
- encerrando a sessão, dados temporários da interface são limpos

## Estrutura dos itens

### Senha

Ideal para contas, sites e serviços:

- título
- login / usuário
- email
- senha
- website opcional
- categoria
- notas

### Texto seguro

Ideal para:

- códigos de recuperação
- respostas de segurança
- anotações privadas
- chaves diversas
- documentos curtos

### Arquivo protegido

Ideal para arquivos pequenos armazenados localmente e criptografados junto ao item.

## Instalação

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y curl build-essential libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2 libgbm1 unzip
```

## Node.js (via nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

## Executar projeto

```bash
git clone <repo-url>
cd Vaulty
npm install
npm run dev
```

## Build desktop

```bash
npm run dist
```

Arquivos gerados em:

```bash
dist-electron/
```

## Armazenamento local

O banco e arquivos internos são salvos na pasta de dados padrão do Electron.

Exemplo no Linux:

```bash
~/.config/Vaulty/
```

## Aviso

Vaulty é um projeto pessoal em evolução.
