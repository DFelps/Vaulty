<!-- src/App.vue -->
<template>
  <div class="app-shell">
    <div class="window-titlebar">
      <div class="window-drag-area">
        <div class="window-brand">
          <ShieldCheck :size="16" />
          <span>Vaulty</span>
        </div>
      </div>

      <div class="window-controls no-drag">
        <button class="window-control-btn" @click="minimizeWindow" aria-label="Minimizar">
          <Minus :size="16" />
        </button>
        <button class="window-control-btn" @click="toggleMaximizeWindow" aria-label="Maximizar">
          <Square v-if="!isMaximized" :size="15" />
          <CopyCheck v-else />
        </button>
        <button class="window-control-btn danger" @click="closeWindow" aria-label="Fechar">
          <X :size="16" />
        </button>
      </div>
    </div>

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

        <button
          class="secondary-btn"
          :class="{ 'success-outline': driveStatus.configured }"
          @click="openDriveSettings"
        >
          <Cloud :size="18" />
          <span>{{ driveStatus.configured ? 'Drive configurado' : 'Configurar Drive' }}</span>
        </button>

        <button
          v-if="driveStatus.configured"
          class="secondary-btn"
          @click="syncGoogleDriveNow"
          :disabled="driveSyncing"
        >
          <RefreshCw :size="18" :class="{ spinning: driveSyncing }" />
          <span>{{ driveSyncing ? 'Sincronizando...' : 'Sincronizar agora' }}</span>
        </button>

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

    <main class="layout" :class="{ 'locked-layout': !unlocked && statusLoaded && status.hasVault }">
      <section v-if="!statusLoaded" class="panel centered-panel">
        <p>Carregando cofre...</p>
      </section>

      <section v-else-if="!status.hasVault" class="panel auth-panel">
        <div class="auth-hero-icon">
          <ShieldCheck :size="36" />
        </div>
        <h2>Criar cofre</h2>
        <p class="muted auth-copy">
          Defina sua chave mestra. Ela será usada para proteger todos os seus itens localmente.
        </p>

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

      <section v-else-if="!unlocked" class="auth-stage">
        <div class="auth-stage-copy">
          <div class="auth-hero-icon large">
            <LockKeyhole :size="42" />
          </div>
          <h2>Acesse seu cofre</h2>
          <p>
            Seus dados permanecem criptografados localmente e só são liberados com sua chave mestra.
          </p>
        </div>

        <div class="panel auth-panel auth-panel-locked">
          <h3>Desbloquear cofre</h3>
          <p class="muted auth-copy">Digite sua chave mestra para acessar seus itens.</p>
          <p v-if="lockReason" class="warning-text">{{ lockReason }}</p>

          <form class="form-grid" @submit.prevent="handleUnlock">
            <label>
              <span>Chave mestra</span>
              <input
                v-model="unlockPassword"
                type="password"
                required
                placeholder="Sua chave mestra"
                autofocus
              />
            </label>

            <button class="primary-btn full-width">
              <LockKeyhole :size="18" />
              <span>Desbloquear</span>
            </button>
          </form>

          <button class="ghost-btn full-width recovery-link-btn" @click="openRecoveryModal">
            <KeyRound :size="16" />
            <span>Perdi minha chave mestra</span>
          </button>

          <div class="auth-footer-note">
            <ShieldCheck :size="16" />
            <span>
              Seu cofre é bloqueado automaticamente por inatividade e ao minimizar a janela.
            </span>
          </div>
        </div>
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

          <div class="drive-mini panel-mini">
            <div class="drive-mini-header">
              <strong>Google Drive</strong>
              <span :class="driveStatus.configured ? 'status-ok' : 'status-off'">
                {{ driveStatus.configured ? 'Configurado' : 'Desativado' }}
              </span>
            </div>

            <p class="muted small-copy">
              {{
                driveStatus.lastSyncAt
                  ? `Última sync: ${formatDateTime(driveStatus.lastSyncAt)}`
                  : 'Nenhuma sincronização ainda.'
              }}
            </p>

            <button class="ghost-btn small full-width" @click="openDriveSettings">
              <Settings2 :size="16" />
              <span>Ajustes do Drive</span>
            </button>
          </div>

          <div class="recovery-mini panel-mini">
            <div class="drive-mini-header">
              <strong>Recuperação</strong>
              <span :class="recoveryStatus.configured ? 'status-ok' : 'status-warning'">
                {{ recoveryStatus.configured ? 'Ativa' : 'Pendente' }}
              </span>
            </div>

            <p class="muted small-copy">
              {{
                recoveryStatus.configured
                  ? 'Uma chave de recuperação está configurada para este cofre.'
                  : 'Gere uma chave de recuperação para evitar perda de acesso.'
              }}
            </p>

            <button class="ghost-btn small full-width" @click="generateRecoveryKey">
              <KeyRound :size="16" />
              <span>{{ recoveryStatus.configured ? 'Gerar nova chave' : 'Gerar chave' }}</span>
            </button>
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
            <div class="category-actions-row">
              <select v-model="selectedCategory">
                <option value="">Todas</option>
                <option v-for="category in categories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>

              <button type="button" class="ghost-btn small" @click="openCategoryModal">
                <Tags :size="16" />
                <span>Gerenciar</span>
              </button>
            </div>
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

            <div class="filter-tabs">
              <button
                class="filter-tab"
                :class="{ active: selectedFilter === 'all' }"
                @click="selectedFilter = 'all'"
              >
                Todos
              </button>

              <button
                class="filter-tab"
                :class="{ active: selectedFilter === 'favorites' }"
                @click="selectedFilter = 'favorites'"
              >
                Favoritos
              </button>

              <button
                class="filter-tab"
                :class="{ active: selectedFilter === 'password' }"
                @click="selectedFilter = 'password'"
              >
                Senhas
              </button>

              <button
                class="filter-tab"
                :class="{ active: selectedFilter === 'text' }"
                @click="selectedFilter = 'text'"
              >
                Textos
              </button>
            </div>
            <label class="sort-control">
              <span>Ordenar</span>
              <select v-model="sortMode">
                <option value="favorite_recent">Favoritos + recentes</option>
                <option value="recent">Mais recentes</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
              </select>
            </label>
          </div>

          <div v-if="filteredCredentials.length === 0" class="empty-state">
            <FolderSearch :size="34" class="empty-icon" />
            <p>Nenhum item encontrado.</p>
          </div>

          <div v-else class="credential-list">
            <article
              v-for="item in paginatedCredentials"
              :key="item.id"
              class="credential-card"
            >
              <button
                class="ghost-btn favorite-btn"
                :class="{ active: item.favorite }"
                @click="toggleFavorite(item.id)"
                :title="item.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'"
              >
                <Star v-if="item.favorite" :size="17" />
                <StarOff v-else :size="17" />
              </button>

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

                    <button
                      v-if="item.website"
                      type="button"
                      class="credential-link link-button"
                      @click="openWebsite(item.website)"
                    >
                      <LinkIcon :size="14" />
                      <span>{{ item.website }}</span>
                    </button>
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

                <template v-else>
                  <div class="preview-box">
                    <p>{{ item.hasSecretText ? 'Texto protegido disponível' : 'Sem texto protegido' }}</p>
                  </div>

                  <button class="ghost-btn small" @click="openEditModal(item)">
                    <FileText :size="16" />
                    <span>Abrir texto</span>
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

          <div v-if="filteredCredentials.length > ITEMS_PER_PAGE" class="pagination-bar">
            <button
              class="ghost-btn small"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              Anterior
            </button>

            <span>{{ paginationLabel }} · Página {{ currentPage }} de {{ totalPages }}</span>

            <button
              class="ghost-btn small"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              Próxima
            </button>
          </div>
        </section>
      </template>
    </main>

    <div v-if="toast" class="toast">{{ toast }}</div>

    <div v-if="showRecoveryKeyModal" class="modal-overlay">
      <section class="modal modal-small">
        <div class="modal-header">
          <h3>Chave de recuperação</h3>
        </div>

        <div class="recovery-key-body">
          <p class="muted">
            Guarde esta chave fora do Vaulty. Ela permite recuperar o acesso caso você esqueça a chave mestra.
          </p>

          <div class="recovery-key-box">
            <code>{{ generatedRecoveryKey }}</code>
          </div>

          <p class="warning-text">
            Esta chave será exibida apenas agora. Quem tiver essa chave poderá redefinir a chave mestra do cofre.
          </p>

          <div class="drive-reminder-actions">
            <button class="secondary-btn" @click="copyRecoveryKey">
              <Copy :size="16" />
              <span>Copiar chave</span>
            </button>

            <button class="primary-btn" @click="closeRecoveryKeyModal">
              <ShieldCheck :size="16" />
              <span>Já salvei em lugar seguro</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="showRecoveryModal" class="modal-overlay" @click.self="closeRecoveryModal">
      <section class="modal modal-small">
        <div class="modal-header">
          <h3>Recuperar acesso</h3>
          <button class="ghost-btn small" @click="closeRecoveryModal">
            <X :size="16" />
            <span>Fechar</span>
          </button>
        </div>

        <form class="form-grid" @submit.prevent="recoverWithRecoveryKey">
          <p class="muted">
            Use sua chave de recuperação para definir uma nova chave mestra. Seus itens serão recriptografados com a nova chave.
          </p>

          <label>
            <span>Chave de recuperação</span>
            <textarea
              v-model="recoveryForm.recoveryKey"
              rows="3"
              required
              placeholder="Cole sua chave de recuperação"
            ></textarea>
          </label>

          <label>
            <span>Nova chave mestra</span>
            <input
              v-model="recoveryForm.newMasterPassword"
              type="password"
              minlength="8"
              required
              placeholder="No mínimo 8 caracteres"
            />
          </label>

          <label>
            <span>Confirmar nova chave</span>
            <input
              v-model="recoveryForm.confirmPassword"
              type="password"
              minlength="8"
              required
              placeholder="Digite novamente"
            />
          </label>

          <button class="primary-btn full-width">
            <KeyRound :size="16" />
            <span>Redefinir chave mestra</span>
          </button>
        </form>
      </section>
    </div>

    <div v-if="showDriveReminder" class="modal-overlay" @click.self="showDriveReminder = false">
      <section class="modal modal-small">
        <div class="modal-header">
          <h3>Sincronize seu backup agora</h3>
          <button class="ghost-btn small" @click="showDriveReminder = false">
            <X :size="16" />
            <span>Fechar</span>
          </button>
        </div>

        <div class="drive-reminder-body">
          <p class="muted">Já faz mais de 3 dias desde o último backup no Google Drive.</p>

          <div class="drive-reminder-actions">
            <button class="secondary-btn" @click="openDriveSettings">
              <Settings2 :size="16" />
              <span>Configurações</span>
            </button>

            <button class="primary-btn" @click="syncGoogleDriveNow">
              <CloudUpload :size="16" />
              <span>Sincronizar agora</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="showDriveModal" class="modal-overlay" @click.self="closeDriveSettings">
      <section class="modal modal-large">
        <div class="modal-header">
          <h3>Google Drive</h3>
          <button class="ghost-btn small" @click="closeDriveSettings">
            <X :size="16" />
            <span>Fechar</span>
          </button>
        </div>

        <div class="drive-guide">
          <h4>Como configurar</h4>
          <ol>
            <li>Crie uma pasta chamada <strong>Vaulty</strong> no seu Google Drive.</li>
            <li>No Google Cloud, crie credenciais OAuth para app desktop e copie o <strong>Client ID</strong> e o <strong>Client Secret</strong>.</li>
            <li>Gere um <strong>Refresh Token</strong> para a conta Google que vai guardar o backup.</li>
            <li>Cole os dados abaixo e salve.</li>
          </ol>
          <p class="muted">
            O Vaulty envia apenas o backup criptografado do cofre. Sem a chave mestra, o conteúdo continua protegido.
          </p>
        </div>

        <form class="form-grid two-columns" @submit.prevent="saveDriveSettings">
          <label class="full-span">
            <span>Client ID</span>
            <input
              v-model="driveForm.clientId"
              type="text"
              placeholder="Seu client id OAuth"
            />
          </label>

          <label class="full-span">
            <span>Client Secret</span>
            <input
              v-model="driveForm.clientSecret"
              type="password"
              placeholder="Seu client secret OAuth"
            />
          </label>

          <label class="full-span">
            <span>Refresh Token</span>
            <textarea
              v-model="driveForm.refreshToken"
              rows="4"
              placeholder="Cole aqui o refresh token"
            ></textarea>
          </label>

          <label>
            <span>Nome da pasta no Drive</span>
            <input
              v-model="driveForm.folderName"
              type="text"
              placeholder="Vaulty"
            />
          </label>

          <label class="toggle-row">
            <span>Mostrar lembrete a cada 3 dias</span>
            <input
              v-model="driveForm.reminderEnabled"
              type="checkbox"
              class="toggle-checkbox"
            />
          </label>

          <div class="full-span drive-status-box">
            <strong>Status</strong>
            <p class="muted">
              {{
                driveStatus.lastSyncAt
                  ? `Última sincronização: ${formatDateTime(driveStatus.lastSyncAt)}`
                  : 'Nenhum backup sincronizado ainda.'
              }}
            </p>
          </div>

          <div class="full-span drive-reminder-actions">
            <button type="button" class="secondary-btn" @click="syncGoogleDriveNow">
              <CloudUpload :size="16" />
              <span>Sincronizar agora</span>
            </button>

            <button class="primary-btn" type="submit">
              <Save :size="16" />
              <span>Salvar configuração</span>
            </button>
          </div>
        </form>
      </section>
    </div>

    
    <div v-if="showCategoryModal" class="modal-overlay" @click.self="closeCategoryModal">
      <section class="modal modal-small">
        <div class="modal-header">
          <h3>Gerenciar categorias</h3>
          <button class="ghost-btn small" @click="closeCategoryModal">
            <X :size="16" />
            <span>Fechar</span>
          </button>
        </div>

        <form class="form-grid" @submit.prevent="createCategory">
          <label>
            <span>Nova categoria</span>
            <input
              v-model="newCategoryName"
              type="text"
              placeholder="Ex.: Trabalho, Pessoal, Banco..."
            />
          </label>

          <button class="primary-btn full-width">
            <Plus :size="16" />
            <span>Criar categoria</span>
          </button>
        </form>

        <div class="category-list">
          <div
            v-for="category in categoriesList"
            :key="category.id"
            class="category-item"
          >
            <strong>{{ category.name }}</strong>

            <button class="danger-btn small" @click="deleteCategory(category.id)">
              <Trash2 :size="16" />
              <span>Excluir</span>
            </button>
          </div>
        </div>
      </section>
    </div>


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
            <select v-model="form.category">
              <option value="">Sem categoria</option>
              <option v-for="category in categories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </label>

          <label>
            <span>Tipo do item</span>
            <select v-model="form.itemType">
              <option value="password">Senha</option>
              <option value="text">Texto longo</option>
            </select>
          </label>

          <label class="toggle-row">
            <span>Possui website</span>
            <input
              v-model="form.hasWebsite"
              type="checkbox"
              class="toggle-checkbox"
            />
          </label>

          <label v-if="shouldShowWebsiteField()" class="full-span">
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Cloud,
  CloudUpload,
  Copy,
  CopyCheck,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderSearch,
  KeyRound,
  Link as LinkIcon,
  Lock,
  LockKeyhole,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  StarOff,
  Tags,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'

const AUTO_LOCK_MINUTES = 5
const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
const passwordPlaceholder = '••••••••••••••••'
const CLIPBOARD_CLEAR_SECONDS = 20
const ITEMS_PER_PAGE = 6
const currentPage = ref(1)

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
const selectedFilter = ref('all')
const showCategoryModal = ref(false)
const categoriesList = ref([])
const newCategoryName = ref('')
const sessionEndsAt = ref(null)
const sessionSecondsLeft = ref(0)
const clipboardClearTimer = ref(null)
const isMaximized = ref(false)
const showDriveModal = ref(false)
const showDriveReminder = ref(false)
const driveSyncing = ref(false)
const showRecoveryModal = ref(false)
const showRecoveryKeyModal = ref(false)
const generatedRecoveryKey = ref('')
const sortMode = ref('favorite_recent')


const driveStatus = reactive({
  configured: false,
  lastSyncAt: '',
  reminderEnabled: true,
  dueNow: false
})

const recoveryStatus = reactive({
  configured: false
})

let detachForcedLockListener = null
let detachWindowStateListener = null

const createForm = reactive({
  masterPassword: '',
  confirmPassword: ''
})

const driveForm = reactive({
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  folderName: 'Vaulty',
  reminderEnabled: true
})

const recoveryForm = reactive({
  recoveryKey: '',
  newMasterPassword: '',
  confirmPassword: ''
})

const emptyForm = () => ({
  id: null,
  title: '',
  username: '',
  email: '',
  password: '',
  website: '',
  hasWebsite: false,
  category: '',
  notes: '',
  secretText: '',
  itemType: 'password',
  favorite: false
})

const form = reactive(emptyForm())

let idleTimer = null
let countdownTimer = null
let listenersBound = false
let lastActivityTs = 0

watch(() => form.itemType, (type) => {
  if (type !== 'password') {
    form.username = ''
    form.email = ''
    form.password = ''
  }

  if (type !== 'text') {
    form.secretText = ''
  }

  if (type !== 'password' && !form.hasWebsite) {
    form.website = ''
  }
})

watch([search, selectedCategory, selectedFilter, sortMode], () => {
  currentPage.value = 1
})

const categories = computed(() => {
  return categoriesList.value.map((category) => category.name)
})

const categoriesCount = computed(() => categories.value.length)

const filteredCredentials = computed(() => {
  const term = search.value.trim().toLowerCase()

  const filtered = credentials.value.filter((item) => {
    const matchesCategory = !selectedCategory.value || item.category === selectedCategory.value

    const matchesFilter =
      selectedFilter.value === 'all' ||
      (selectedFilter.value === 'favorites' && item.favorite) ||
      (selectedFilter.value === 'password' && item.itemType === 'password') ||
      (selectedFilter.value === 'text' && item.itemType === 'text')

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

    return matchesCategory && matchesFilter && (!term || haystack.includes(term))
  })

  return [...filtered].sort((a, b) => {
    if (sortMode.value === 'az') {
      return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
    }

    if (sortMode.value === 'za') {
      return String(b.title || '').localeCompare(String(a.title || ''), 'pt-BR')
    }

    if (sortMode.value === 'recent') {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    }

    const favoriteDiff = Number(b.favorite) - Number(a.favorite)
    if (favoriteDiff !== 0) return favoriteDiff

    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  })
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredCredentials.value.length / ITEMS_PER_PAGE))
})

const paginatedCredentials = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return filteredCredentials.value.slice(start, start + ITEMS_PER_PAGE)
})

const paginationLabel = computed(() => {
  if (filteredCredentials.value.length === 0) return '0 itens'

  const start = (currentPage.value - 1) * ITEMS_PER_PAGE + 1
  const end = Math.min(currentPage.value * ITEMS_PER_PAGE, filteredCredentials.value.length)

  return `${start}-${end} de ${filteredCredentials.value.length}`
})

function clampCurrentPage() {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }

  if (currentPage.value < 1) {
    currentPage.value = 1
  }
}

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

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function clearClipboardTimer() {
  if (clipboardClearTimer.value) {
    window.clearTimeout(clipboardClearTimer.value)
    clipboardClearTimer.value = null
  }
}

async function scheduleClipboardClear() {
  clearClipboardTimer()

  clipboardClearTimer.value = window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText()
      if (current) {
        await navigator.clipboard.writeText('')
        setToast('Área de transferência limpa automaticamente.')
      }
    } catch {
      // silencioso
    }
  }, CLIPBOARD_CLEAR_SECONDS * 1000)
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

async function refreshDriveStatus() {
  const result = await window.vaulty.driveGetStatus()

  if (result?.success === false) {
    return
  }

  driveStatus.configured = Boolean(result.configured)
  driveStatus.lastSyncAt = result.lastSyncAt || ''
  driveStatus.reminderEnabled = result.reminderEnabled !== false
  driveStatus.dueNow = Boolean(result.dueNow)

  if (unlocked.value && driveStatus.configured && driveStatus.dueNow && driveStatus.reminderEnabled) {
    showDriveReminder.value = true
  }
}

async function refreshRecoveryStatus() {
  const result = await window.vaulty.recoveryGetStatus()

  if (result?.success === false) {
    recoveryStatus.configured = false
    return
  }

  recoveryStatus.configured = Boolean(result.hasRecoveryKey)
}

async function loadRecoveryStatus() {
  await refreshRecoveryStatus()
}

async function generateRecoveryKey() {
  const confirmed = recoveryStatus.configured
    ? window.confirm('Gerar uma nova chave de recuperação? A chave anterior deixará de funcionar.')
    : true

  if (!confirmed) return

  const result = await window.vaulty.recoveryGenerateKey()

  if (result?.success === false) {
    setToast(result.error || 'Não foi possível gerar a chave de recuperação.')
    return
  }

  generatedRecoveryKey.value = result.recoveryKey || ''
  showRecoveryKeyModal.value = true
  recoveryStatus.configured = true

  await refreshRecoveryStatus()

  setToast('Chave de recuperação gerada.')
}

function closeRecoveryKeyModal() {
  generatedRecoveryKey.value = ''
  showRecoveryKeyModal.value = false
}

async function copyRecoveryKey() {
  if (!generatedRecoveryKey.value) return

  await navigator.clipboard.writeText(generatedRecoveryKey.value)
  setToast(`Chave copiada. A área de transferência será limpa em ${CLIPBOARD_CLEAR_SECONDS}s.`)
  await scheduleClipboardClear()
}

function openRecoveryModal() {
  recoveryForm.recoveryKey = ''
  recoveryForm.newMasterPassword = ''
  recoveryForm.confirmPassword = ''
  showRecoveryModal.value = true
}

function closeRecoveryModal() {
  showRecoveryModal.value = false
  recoveryForm.recoveryKey = ''
  recoveryForm.newMasterPassword = ''
  recoveryForm.confirmPassword = ''
}

async function recoverWithRecoveryKey() {
  if (recoveryForm.newMasterPassword !== recoveryForm.confirmPassword) {
    setToast('As novas chaves não conferem.')
    return
  }

  const confirmed = window.confirm(
    'Redefinir a chave mestra usando a chave de recuperação? Seus dados serão recriptografados.'
  )

  if (!confirmed) return

  const result = await window.vaulty.recoveryRecoverWithKey({
    recoveryKey: recoveryForm.recoveryKey,
    newMasterPassword: recoveryForm.newMasterPassword
  })

  if (result?.success === false) {
    setToast(result.error || 'Não foi possível recuperar o acesso.')
    return
  }

  closeRecoveryModal()
  unlockPassword.value = ''
  unlocked.value = true
  status.value = { hasVault: true, unlocked: true }
  lockReason.value = ''
  startSessionTracking()
  await loadCredentials()
  await loadCategories()
  await refreshDriveStatus()
  await refreshRecoveryStatus()
  setToast('Chave mestra redefinida com sucesso.')
}

async function openDriveSettings() {
  const result = await window.vaulty.driveGetSettings()

  if (result?.success === false) {
    setToast(result.error)
    return
  }

  driveForm.clientId = result.settings.clientId || ''
  driveForm.clientSecret = result.settings.clientSecret || ''
  driveForm.refreshToken = result.settings.refreshToken || ''
  driveForm.folderName = result.settings.folderName || 'Vaulty'
  driveForm.reminderEnabled = result.settings.reminderEnabled !== false
  showDriveModal.value = true
}

function closeDriveSettings() {
  showDriveModal.value = false
}

async function saveDriveSettings() {
  const payload = {
    clientId: driveForm.clientId.trim(),
    clientSecret: driveForm.clientSecret.trim(),
    refreshToken: driveForm.refreshToken.trim(),
    folderName: (driveForm.folderName || 'Vaulty').trim() || 'Vaulty',
    reminderEnabled: Boolean(driveForm.reminderEnabled)
  }

  if (!payload.clientId || !payload.clientSecret || !payload.refreshToken) {
    setToast('Preencha Client ID, Client Secret e Refresh Token.')
    return
  }

  const result = await window.vaulty.driveSaveSettings(payload)

  if (result?.success === false) {
    setToast(result.error || 'Erro ao salvar configuração do Drive.')
    return
  }

  await refreshDriveStatus()
  showDriveModal.value = false
  setToast('Configuração do Google Drive salva.')
}

async function syncGoogleDriveNow() {
  if (driveSyncing.value) return

  driveSyncing.value = true
  const result = await window.vaulty.driveSyncNow()
  driveSyncing.value = false

  if (result?.success === false) {
    setToast(result.error || 'Falha ao sincronizar com o Google Drive.')
    return
  }

  await refreshDriveStatus()
  showDriveReminder.value = false
  setToast('Backup sincronizado com o Google Drive.')
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
  await loadCategories()
  await refreshDriveStatus()
  await refreshRecoveryStatus()

  if (result.recoveryKey) {
    generatedRecoveryKey.value = result.recoveryKey
    showRecoveryKeyModal.value = true
  }

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
  await loadCategories()
  await refreshDriveStatus()
  await refreshRecoveryStatus()
  setToast('Cofre desbloqueado.')
}

async function lockVault(reason = '') {
  await window.vaulty.lock()
  stopSessionTracking()
  clearClipboardTimer()
  unlocked.value = false
  credentials.value = []
  search.value = ''
  selectedCategory.value = ''
  generatedPassword.value = ''
  lockReason.value = reason
  showDriveReminder.value = false
  showDriveModal.value = false
  showRecoveryModal.value = false
  showRecoveryKeyModal.value = false
  generatedRecoveryKey.value = ''

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
  return 'Senha'
}

function typeIcon(type) {
  if (type === 'text') return FileText
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
    hasWebsite: Boolean(result.credential.website)
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
    website: shouldShowWebsiteField() ? (form.website || '') : '',
    notes: form.notes || '',
    itemType: form.itemType || 'password',
    favorite: Boolean(form.favorite),
    username: '',
    email: '',
    password: '',
    secretText: ''
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

  const result = await window.vaulty.saveCredential(payload)

  if (result?.success === false) {
    setToast(result.error || 'Erro ao salvar item.')
    return
  }

  closeModal()
  await loadCredentials()

  clampCurrentPage()

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

  clampCurrentPage()

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
  setToast(`Senha copiada. A área de transferência será limpa em ${CLIPBOARD_CLEAR_SECONDS}s.`)
  await scheduleClipboardClear()
}

async function copyText(value) {
  markActivity()

  if (!value) {
    setToast('Nada para copiar.')
    return
  }

  await navigator.clipboard.writeText(value)
  setToast(`Copiado. A área de transferência será limpa em ${CLIPBOARD_CLEAR_SECONDS}s.`)
  await scheduleClipboardClear()
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
    await loadCategories()
    clampCurrentPage()
    setToast(`${result.imported} item(ns) importado(s).`)
  }
}

function shouldShowWebsiteField() {
  return form.itemType === 'password' || form.hasWebsite
}

async function openWebsite(url) {
  if (!url) return

  const result = await window.vaulty.openExternal(url)
  if (result?.success === false) {
    setToast(result.error || 'Não foi possível abrir o link.')
  }
}

async function minimizeWindow() {
  await window.vaulty.minimizeWindow()
}

async function toggleMaximizeWindow() {
  const result = await window.vaulty.toggleMaximizeWindow()
  if (typeof result?.isMaximized === 'boolean') {
    isMaximized.value = result.isMaximized
  }
}

async function closeWindow() {
  await window.vaulty.closeWindow()
}

async function loadCategories() {
  const result = await window.vaulty.listCategories()

  if (result?.success === false) {
    setToast(result.error || 'Não foi possível carregar categorias.')
    return
  }

  categoriesList.value = Array.isArray(result.categories) ? result.categories : []
}

function openCategoryModal() {
  newCategoryName.value = ''
  showCategoryModal.value = true
}

function closeCategoryModal() {
  showCategoryModal.value = false
  newCategoryName.value = ''
}

async function createCategory() {
  const name = newCategoryName.value.trim()

  if (!name) {
    setToast('Informe o nome da categoria.')
    return
  }

  const result = await window.vaulty.createCategory(name)

  if (result?.success === false) {
    setToast(result.error || 'Não foi possível criar categoria.')
    return
  }

  newCategoryName.value = ''
  await loadCategories()
  setToast('Categoria criada.')
}

async function deleteCategory(id) {
  const confirmed = window.confirm(
    'Excluir esta categoria? Os itens dela ficarão sem categoria.'
  )

  if (!confirmed) return

  const result = await window.vaulty.deleteCategory(id)

  if (result?.success === false) {
    setToast(result.error || 'Não foi possível excluir categoria.')
    return
  }

  await loadCategories()

  if (selectedCategory.value) {
    const stillExists = categoriesList.value.some(
      category => category.name === selectedCategory.value
    )

    if (!stillExists) {
      selectedCategory.value = ''
    }
  }

  await loadCredentials()
  clampCurrentPage()

  setToast('Categoria excluída.')
}

async function toggleFavorite(id) {
  markActivity()

  const result = await window.vaulty.toggleFavorite(id)

  if (result?.success === false) {
    setToast(result.error || 'Não foi possível favoritar item.')
    return
  }

  await loadCredentials()
  clampCurrentPage()
}

onMounted(async () => {
  await refreshStatus()
  await refreshRecoveryStatus()

  if (typeof window.vaulty.onForcedLock === 'function') {
    detachForcedLockListener = window.vaulty.onForcedLock(async (payload) => {
      await lockVault(payload?.reason || 'Sessão bloqueada pelo sistema.')
    })
  }

  if (typeof window.vaulty.onWindowState === 'function') {
    detachWindowStateListener = window.vaulty.onWindowState((payload) => {
      if (typeof payload?.isMaximized === 'boolean') {
        isMaximized.value = payload.isMaximized
      }
    })
  }

  if (typeof window.vaulty.getWindowState === 'function') {
    const state = await window.vaulty.getWindowState()
    if (typeof state?.isMaximized === 'boolean') {
      isMaximized.value = state.isMaximized
    }
  }

  if (status.value.unlocked) {
    unlocked.value = true
    startSessionTracking()
    await loadCredentials()
    await loadCategories()
    await refreshDriveStatus()
    await refreshRecoveryStatus()
    clampCurrentPage()
  }
})

onBeforeUnmount(() => {
  stopSessionTracking()
  clearClipboardTimer()

  if (typeof detachForcedLockListener === 'function') {
    detachForcedLockListener()
  }

  if (typeof detachWindowStateListener === 'function') {
    detachWindowStateListener()
  }
})
</script>