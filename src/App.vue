<!-- src/App.vue -->
<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <div class="brand-row">
          <div class="brand-icon-svg">
            <ShieldCheck :size="30" :stroke-width="2.2" />
          </div>
          <div>
            <h1>Vaulty</h1>
            <p>Gerenciador local com Electron + Vue</p>
          </div>
        </div>
      </div>

      <div v-if="unlocked" class="topbar-actions">
        <div class="session-chip">
          <strong>Sessão ativa</strong>
          <span>bloqueio automático em {{ sessionCountdownLabel }}</span>
        </div>

        <button class="secondary-btn" @click="importBackup">
          <Upload :size="18" />
          <span>Importar backup</span>
        </button>

        <button class="secondary-btn" @click="exportBackup">
          <Download :size="18" />
          <span>Exportar backup</span>
        </button>

        <button class="primary-btn" @click="openCreateModal">
          <Plus :size="18" />
          <span>Novo item</span>
        </button>

        <button class="ghost-btn" @click="lockVault()">
          <Lock :size="18" />
          <span>Bloquear</span>
        </button>
      </div>
    </header>

    <main class="layout">
      <section v-if="!statusLoaded" class="panel centered-panel">
        <p>Carregando cofre...</p>
      </section>

      <section v-else-if="!status.hasVault" class="panel auth-panel">
        <h2>Criar cofre</h2>
        <p class="muted">Defina sua chave mestra. Ela será usada para proteger todos os seus itens.</p>

        <form class="form-grid" @submit.prevent="handleCreateVault">
          <label>
            <span>Chave mestra</span>
            <input
              v-model="createForm.masterPassword"
              type="password"
              minlength="8"
              required
              placeholder="No mínimo 8 caracteres"
            />
          </label>

          <label>
            <span>Confirmar chave</span>
            <input
              v-model="createForm.confirmPassword"
              type="password"
              minlength="8"
              required
              placeholder="Digite novamente"
            />
          </label>

          <button class="primary-btn full-width">
            <ShieldCheck :size="18" />
            <span>Criar cofre</span>
          </button>
        </form>
      </section>

      <section v-else-if="!unlocked" class="panel auth-panel">
        <h2>Desbloquear cofre</h2>
        <p class="muted">Digite sua chave mestra para acessar seus itens.</p>
        <p v-if="lockReason" class="warning-text">{{ lockReason }}</p>

        <form class="form-grid" @submit.prevent="handleUnlock">
          <label>
            <span>Chave mestra</span>
            <input
              v-model="unlockPassword"
              type="password"
              required
              placeholder="Sua chave mestra"
            />
          </label>

          <button class="primary-btn full-width">
            <LockKeyhole :size="18" />
            <span>Desbloquear</span>
          </button>
        </form>
      </section>

      <template v-else>
        <aside class="sidebar panel">
          <h3>Resumo</h3>

          <div class="stats-grid">
            <article class="stat-card">
              <strong>{{ credentials.length }}</strong>
              <span>itens salvos</span>
            </article>

            <article class="stat-card">
              <strong>{{ categoriesCount }}</strong>
              <span>categorias</span>
            </article>
          </div>

          <label>
            <span>Buscar</span>
            <input
              v-model="search"
              type="text"
              placeholder="Título, email, site, nota..."
            />
          </label>

          <label>
            <span>Categoria</span>
            <select v-model="selectedCategory">
              <option value="">Todas</option>
              <option
                v-for="category in categories"
                :key="category"
                :value="category"
              >
                {{ category }}
              </option>
            </select>
          </label>

          <button class="secondary-btn full-width" @click="generateStrongPassword">
            <Sparkles :size="18" />
            <span>Gerar senha forte</span>
          </button>

          <div v-if="generatedPassword" class="generated-box">
            <code>{{ generatedPassword }}</code>
            <button class="ghost-btn small" @click="copyText(generatedPassword)">
              <Copy :size="16" />
              <span>Copiar</span>
            </button>
          </div>
        </aside>

        <section class="content panel">
          <div class="content-header">
            <div>
              <h2>Itens protegidos</h2>
              <p class="muted">
                Sessão ativa libera ações sensíveis até o bloqueio automático após
                {{ AUTO_LOCK_MINUTES }} min.
              </p>
            </div>
          </div>

          <div v-if="filteredCredentials.length === 0" class="empty-state">
            <FolderSearch :size="34" class="empty-icon" />
            <p>Nenhum item encontrado.</p>
          </div>

          <div v-else class="credential-list">
            <article
              v-for="item in filteredCredentials"
              :key="item.id"
              class="credential-card"
            >
              <div class="credential-main">
                <div>
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.username || item.email || item.notes || 'Sem resumo disponível' }}</p>

                  <div class="badge-row">
                    <span class="badge">{{ item.category || 'Sem categoria' }}</span>

                    <span class="badge subtle-badge">
                      <component :is="typeIcon(item.itemType)" :size="13" />
                      <span>{{ typeLabel(item.itemType) }}</span>
                    </span>

                    <a
                      v-if="item.website"
                      :href="item.website"
                      target="_blank"
                      rel="noreferrer"
                      class="credential-link"
                    >
                      <LinkIcon :size="14" />
                      <span>{{ item.website }}</span>
                    </a>
                  </div>
                </div>
              </div>

              <div class="secret-box">
                <template v-if="item.itemType === 'password'">
                  <input
                    :type="visiblePasswords[item.id] ? 'text' : 'password'"
                    :value="visiblePasswords[item.id] ? (revealedPasswords[item.id] || '') : passwordPlaceholder"
                    readonly
                  />

                  <button class="ghost-btn small" @click="toggleVisibility(item.id)">
                    <component :is="visiblePasswords[item.id] ? EyeOff : Eye" :size="16" />
                    <span>{{ visiblePasswords[item.id] ? 'Ocultar' : 'Mostrar' }}</span>
                  </button>
                </template>

                <template v-else-if="item.itemType === 'text'">
                  <div class="preview-box">
                    <p>{{ item.hasSecretText ? 'Texto protegido disponível' : 'Sem texto protegido' }}</p>
                  </div>

                  <button class="ghost-btn small" @click="openEditModal(item)">
                    <FileText :size="16" />
                    <span>Abrir texto</span>
                  </button>
                </template>

                <template v-else>
                  <div class="preview-box">
                    <p>{{ item.attachmentCount || 0 }} arquivo(s) protegido(s)</p>
                  </div>

                  <button class="ghost-btn small" @click="openEditModal(item)">
                    <Paperclip :size="16" />
                    <span>Ver arquivos</span>
                  </button>
                </template>
              </div>

              <div class="card-actions">
                <button
                  v-if="item.username || item.email"
                  class="secondary-btn small"
                  @click="copyText(item.username || item.email)"
                >
                  <Copy :size="16" />
                  <span>Copiar login</span>
                </button>

                <button
                  v-if="item.itemType === 'password'"
                  class="secondary-btn small"
                  @click="copyPassword(item.id)"
                >
                  <KeyRound :size="16" />
                  <span>Copiar senha</span>
                </button>

                <button class="secondary-btn small" @click="openEditModal(item)">
                  <Pencil :size="16" />
                  <span>Editar</span>
                </button>

                <button class="danger-btn small" @click="removeCredential(item.id)">
                  <Trash2 :size="16" />
                  <span>Excluir</span>
                </button>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>

    <div v-if="toast" class="toast">{{ toast }}</div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <section class="modal modal-large">
        <div class="modal-header">
          <h3>{{ form.id ? 'Editar item' : 'Novo item' }}</h3>

          <button class="ghost-btn small" @click="closeModal">
            <X :size="16" />
            <span>Fechar</span>
          </button>
        </div>

        <form class="form-grid two-columns" @submit.prevent="saveCredential">
          <label>
            <span>Título</span>
            <input
              v-model="form.title"
              type="text"
              required
              placeholder="Ex.: GitHub / Documento / Anotação"
            />
          </label>

          <label>
            <span>Categoria</span>
            <input
              v-model="form.category"
              type="text"
              placeholder="Ex.: Trabalho"
            />
          </label>

          <label>
            <span>Tipo do item</span>
            <select v-model="form.itemType">
              <option value="password">Senha</option>
              <option value="text">Texto longo</option>
              <option value="file">Arquivo</option>
            </select>
          </label>

          <label>
            <span>Website</span>
            <input
              v-model="form.website"
              type="url"
              placeholder="https://site.com"
            />
          </label>

          <label v-if="form.itemType === 'password'">
            <span>Usuário</span>
            <input
              v-model="form.username"
              type="text"
              placeholder="Login"
            />
          </label>

          <label v-if="form.itemType === 'password'">
            <span>Email</span>
            <input
              v-model="form.email"
              type="email"
              placeholder="email@exemplo.com"
            />
          </label>

          <label class="full-span">
            <span>Notas rápidas</span>
            <textarea
              v-model="form.notes"
              rows="3"
              placeholder="Descrição curta para busca e organização"
            ></textarea>
          </label>

          <label v-if="form.itemType === 'password'" class="full-span">
            <span>Senha</span>
            <div class="inline-row">
              <input
                v-model="form.password"
                type="text"
                placeholder="Senha"
              />
              <button
                type="button"
                class="secondary-btn"
                @click="form.password = generatePassword()"
              >
                <Sparkles :size="16" />
                <span>Gerar</span>
              </button>
            </div>
          </label>

          <label v-if="form.itemType === 'text'" class="full-span">
            <span>Texto seguro longo</span>
            <textarea
              v-model="form.secretText"
              rows="12"
              placeholder="Guarde anotações longas, códigos, respostas de segurança, chaves, observações privadas..."
            ></textarea>
          </label>

          <div v-if="form.itemType === 'file'" class="full-span attachment-block">
            <div class="attachment-label-row">
              <span class="attachment-title">Arquivos anexos</span>

              <label class="file-picker-btn">
                <Paperclip :size="16" />
                <span>Adicionar arquivos</span>
                <input type="file" multiple @change="handleFileSelection" />
              </label>
            </div>

            <p class="muted attachment-help">
              Ideal para arquivos pequenos. Eles ficam criptografados junto com o item.
            </p>

            <div v-if="form.attachments.length" class="attachment-list">
              <div
                v-for="(attachment, index) in form.attachments"
                :key="`${attachment.name}-${index}`"
                class="attachment-item"
              >
                <div class="attachment-meta">
                  <Paperclip :size="16" />
                  <div>
                    <strong>{{ attachment.name }}</strong>
                    <span>{{ formatBytes(attachment.size || 0) }}</span>
                  </div>
                </div>

                <div class="attachment-actions">
                  <button
                    type="button"
                    class="ghost-btn small"
                    @click="downloadAttachment(attachment)"
                  >
                    <Download :size="16" />
                    <span>Baixar</span>
                  </button>

                  <button
                    type="button"
                    class="danger-btn small"
                    @click="removeAttachment(index)"
                  >
                    <Trash2 :size="16" />
                    <span>Remover</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button class="primary-btn full-span">
            <Save :size="18" />
            <span>Salvar item</span>
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderSearch,
  KeyRound,
  Link as LinkIcon,
  Lock,
  LockKeyhole,
  Paperclip,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'

const AUTO_LOCK_MINUTES = 5
const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
const passwordPlaceholder = '••••••••••••••••'
const MAX_FILE_SIZE = 5 * 1024 * 1024

const statusLoaded = ref(false)
const status = ref({ hasVault: false, unlocked: false })
const unlocked = ref(false)
const unlockPassword = ref('')
const credentials = ref([])
const search = ref('')
const selectedCategory = ref('')
const showModal = ref(false)
const generatedPassword = ref('')
const toast = ref('')
const lockReason = ref('')
const visiblePasswords = reactive({})
const revealedPasswords = reactive({})
const sessionEndsAt = ref(null)
const sessionSecondsLeft = ref(0)

const createForm = reactive({
  masterPassword: '',
  confirmPassword: ''
})

const emptyForm = () => ({
  id: null,
  title: '',
  username: '',
  email: '',
  password: '',
  website: '',
  category: '',
  notes: '',
  secretText: '',
  itemType: 'password',
  attachments: []
})

const form = reactive(emptyForm())

let idleTimer = null
let countdownTimer = null
let listenersBound = false
let lastActivityTs = 0

const categories = computed(() => {
  return [...new Set(credentials.value.map((item) => item.category).filter(Boolean))].sort()
})

const categoriesCount = computed(() => categories.value.length)

const filteredCredentials = computed(() => {
  const term = search.value.trim().toLowerCase()

  return credentials.value.filter((item) => {
    const matchesCategory = !selectedCategory.value || item.category === selectedCategory.value
    const haystack = [
      item.title,
      item.username,
      item.email,
      item.website,
      item.category,
      item.notes
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return matchesCategory && (!term || haystack.includes(term))
  })
})

const sessionCountdownLabel = computed(() => {
  const total = Math.max(0, sessionSecondsLeft.value)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

function setToast(message) {
  toast.value = message
  window.clearTimeout(setToast._timer)
  setToast._timer = window.setTimeout(() => {
    toast.value = ''
  }, 2600)
}

function clearIdleTimers() {
  if (idleTimer) {
    window.clearTimeout(idleTimer)
    idleTimer = null
  }

  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function updateCountdown() {
  if (!sessionEndsAt.value) {
    sessionSecondsLeft.value = 0
    return
  }

  sessionSecondsLeft.value = Math.max(
    0,
    Math.ceil((sessionEndsAt.value - Date.now()) / 1000)
  )
}

async function handleAutoLock() {
  if (!unlocked.value) return
  await lockVault('Sessão bloqueada por inatividade.')
}

function scheduleAutoLock() {
  clearIdleTimers()
  sessionEndsAt.value = Date.now() + AUTO_LOCK_MS
  updateCountdown()

  idleTimer = window.setTimeout(() => {
    handleAutoLock()
  }, AUTO_LOCK_MS)

  countdownTimer = window.setInterval(() => {
    updateCountdown()
  }, 1000)
}

function markActivity() {
  if (!unlocked.value) return

  const now = Date.now()
  if (now - lastActivityTs < 750) return

  lastActivityTs = now
  scheduleAutoLock()
}

function bindActivityListeners() {
  if (listenersBound) return

  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, markActivity, true)
  })

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', markActivity)
  listenersBound = true
}

function unbindActivityListeners() {
  if (!listenersBound) return

  ACTIVITY_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, markActivity, true)
  })

  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', markActivity)
  listenersBound = false
}

function handleVisibilityChange() {
  if (!unlocked.value) return

  if (document.visibilityState === 'visible') {
    markActivity()
  }
}

function startSessionTracking() {
  bindActivityListeners()
  scheduleAutoLock()
}

function stopSessionTracking() {
  clearIdleTimers()
  unbindActivityListeners()
  sessionEndsAt.value = null
  sessionSecondsLeft.value = 0
}

async function refreshStatus() {
  const result = await window.vaulty.getStatus()
  status.value = result
  unlocked.value = result.unlocked
  statusLoaded.value = true
}

async function loadCredentials() {
  const result = await window.vaulty.listCredentials()

  if (Array.isArray(result)) {
    credentials.value = result
    return
  }

  if (result?.success === false) {
    setToast(result.error)
  }
}

async function handleCreateVault() {
  if (createForm.masterPassword !== createForm.confirmPassword) {
    setToast('As chaves não conferem.')
    return
  }

  const result = await window.vaulty.createVault(createForm.masterPassword)

  if (result.success === false) {
    setToast(result.error)
    return
  }

  createForm.masterPassword = ''
  createForm.confirmPassword = ''
  unlocked.value = true
  status.value = { hasVault: true, unlocked: true }
  lockReason.value = ''
  startSessionTracking()
  await loadCredentials()
  setToast('Cofre criado com sucesso.')
}

async function handleUnlock() {
  const result = await window.vaulty.unlock(unlockPassword.value)

  if (result.success === false) {
    setToast(result.error)
    return
  }

  unlockPassword.value = ''
  unlocked.value = true
  lockReason.value = ''
  startSessionTracking()
  await loadCredentials()
  setToast('Cofre desbloqueado.')
}

async function lockVault(reason = '') {
  await window.vaulty.lock()
  stopSessionTracking()
  unlocked.value = false
  credentials.value = []
  search.value = ''
  selectedCategory.value = ''
  generatedPassword.value = ''
  lockReason.value = reason

  Object.keys(visiblePasswords).forEach((key) => delete visiblePasswords[key])
  Object.keys(revealedPasswords).forEach((key) => delete revealedPasswords[key])

  closeModal()
  await refreshStatus()
}

function resetForm() {
  Object.assign(form, emptyForm())
}

function typeLabel(type) {
  if (type === 'text') return 'Texto longo'
  if (type === 'file') return 'Arquivo'
  return 'Senha'
}

function typeIcon(type) {
  if (type === 'text') return FileText
  if (type === 'file') return Paperclip
  return KeyRound
}

function openCreateModal() {
  markActivity()
  resetForm()
  showModal.value = true
}

async function openEditModal(item) {
  markActivity()

  const result = await window.vaulty.getCredentialForEdit(item.id)

  if (result?.success === false) {
    setToast(result.error)
    return
  }

  Object.assign(form, {
    ...emptyForm(),
    ...result.credential,
    attachments: Array.isArray(result.credential.attachments)
      ? result.credential.attachments
      : []
  })

  showModal.value = true
}

function closeModal() {
  showModal.value = false
  resetForm()
}

async function saveCredential() {
  markActivity()

  const payload = {
    id: form.id,
    title: (form.title || '').trim(),
    category: form.category || '',
    website: form.website || '',
    notes: form.notes || '',
    itemType: form.itemType || 'password',

    username: '',
    email: '',
    password: '',
    secretText: '',
    attachments: []
  }

  if (!payload.title) {
    setToast('Informe um título.')
    return
  }

  if (payload.itemType === 'password') {
    payload.username = form.username || ''
    payload.email = form.email || ''
    payload.password = form.password || ''
  }

  if (payload.itemType === 'text') {
    payload.secretText = form.secretText || ''
  }

  if (payload.itemType === 'file') {
    payload.attachments = Array.isArray(form.attachments)
      ? form.attachments
      : []
  }

  const result = await window.vaulty.saveCredential(payload)

  if (result?.success === false) {
    setToast(result.error || 'Erro ao salvar item.')
    return
  }

  closeModal()
  await loadCredentials()
  setToast('Item salvo com sucesso.')
}

async function removeCredential(id) {
  markActivity()

  const confirmed = window.confirm('Excluir este item?')
  if (!confirmed) return

  const result = await window.vaulty.deleteCredential(id)

  if (result.success === false) {
    setToast(result.error)
    return
  }

  delete visiblePasswords[id]
  delete revealedPasswords[id]

  await loadCredentials()
  setToast('Item excluído.')
}

async function ensurePasswordLoaded(id) {
  if (revealedPasswords[id]) return revealedPasswords[id]

  const result = await window.vaulty.revealPassword(id)

  if (result?.success === false) {
    setToast(result.error)
    return ''
  }

  revealedPasswords[id] = result.password || ''
  return revealedPasswords[id]
}

async function toggleVisibility(id) {
  markActivity()

  if (!visiblePasswords[id]) {
    const password = await ensurePasswordLoaded(id)
    if (!password) return
    visiblePasswords[id] = true
    return
  }

  visiblePasswords[id] = false
}

async function copyPassword(id) {
  markActivity()

  const password = await ensurePasswordLoaded(id)

  if (!password) {
    setToast('Nenhuma senha encontrada para este item.')
    return
  }

  await navigator.clipboard.writeText(password)
  setToast('Senha copiada para a área de transferência.')
}

async function copyText(value) {
  markActivity()

  if (!value) {
    setToast('Nada para copiar.')
    return
  }

  await navigator.clipboard.writeText(value)
  setToast('Copiado para a área de transferência.')
}

function generatePassword(size = 20) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-+='
  let out = ''

  crypto.getRandomValues(new Uint32Array(size)).forEach((n) => {
    out += chars[n % chars.length]
  })

  return out
}

function generateStrongPassword() {
  markActivity()
  generatedPassword.value = generatePassword()
}

async function exportBackup() {
  markActivity()
  const result = await window.vaulty.exportBackup()
  if (result?.success) setToast('Backup exportado.')
}

async function importBackup() {
  markActivity()
  const result = await window.vaulty.importBackup()

  if (result?.success) {
    await loadCredentials()
    setToast(`${result.imported} item(ns) importado(s).`)
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let value = bytes

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }

    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

async function handleFileSelection(event) {
  markActivity()

  const files = Array.from(event.target.files || [])
  if (!files.length) return

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      setToast(`O arquivo ${file.name} excede o limite de 5 MB.`)
      continue
    }

    const base64 = await fileToBase64(file)

    form.attachments.push({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      data: base64
    })
  }

  event.target.value = ''
}

function removeAttachment(index) {
  form.attachments.splice(index, 1)
}

function downloadAttachment(attachment) {
  const type = attachment.type || 'application/octet-stream'
  const link = document.createElement('a')
  link.href = `data:${type};base64,${attachment.data}`
  link.download = attachment.name || 'arquivo'
  link.click()
}

onMounted(async () => {
  await refreshStatus()

  if (status.value.unlocked) {
    unlocked.value = true
    startSessionTracking()
    await loadCredentials()
  }
})

onBeforeUnmount(() => {
  stopSessionTracking()
})
</script>