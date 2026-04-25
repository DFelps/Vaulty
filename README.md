# Vaulty

Vaulty é um gerenciador de senhas e cofre digital local para desktop, desenvolvido com **Electron + Vue**.

Todos os dados permanecem no dispositivo do usuário e são protegidos por **chave mestra**, **criptografia local** e controles de sessão.

---

## Recursos

- Cofre local protegido por chave mestra
- Bloqueio automático por inatividade
- Cadastro de senhas e textos seguros
- Busca e categorias
- Gerador de senha forte
- Backup criptografado
- Recovery Key
- Integração Google Drive (opcional)

---

## Stack

- Electron
- Vue 3
- Vite
- better-sqlite3
- Node.js Crypto API

---

## Instalação

```bash
git clone <repo-url>
cd Vaulty
npm install
npm run dev
```

## Build

```bash
npm run dist
```

Saída:

```text
dist-electron/
```

---

## Segurança

- Senha mestra não é salva em texto puro
- Dados sensíveis criptografados em disco
- Sessão limpa ao bloquear
- Backup exportado criptografado

> Se perder a senha mestra e a Recovery Key, não há recuperação.

---

## Licença

MIT
