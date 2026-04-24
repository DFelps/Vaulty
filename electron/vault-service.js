const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { dialog, app } = require('electron')
const { initializeDatabase } = require('./database')
const { uploadBackupToDrive, BACKUP_FILENAME } = require('./google-drive-service')

const {
  encryptJson,
  decryptJson,
  createVaultMetadata,
  verifyMasterPassword,
  makeSessionKey,
  generateRecoveryKey: createRecoveryKey,
  hashRecoveryKey,
  verifyRecoveryKey,
  normalizeRecoveryKey
} = require('./crypto')

class VaultService {
  constructor() {
    this.db = initializeDatabase()

    this.sessionKey = null
    this.unlockFailures = []
    this.unlockBlockedUntil = 0
  }

  getStatus() {
    const row = this.db
      .prepare('SELECT id FROM vault_meta WHERE id = 1')
      .get()

    return {
      hasVault: Boolean(row),
      unlocked: Boolean(this.sessionKey)
    }
  }

  requireUnlocked() {
    if (!this.sessionKey) {
      throw new Error('Cofre bloqueado.')
    }
  }

  lock() {
    this.sessionKey = null
    return { success: true }
  }

  createVault(masterPassword) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('A chave mestra precisa ter pelo menos 8 caracteres.')
    }

    const existing = this.db
      .prepare('SELECT id FROM vault_meta WHERE id = 1')
      .get()

    if (existing) {
      throw new Error('O cofre já foi criado.')
    }

    const meta = createVaultMetadata(masterPassword)

    this.db.prepare(`
      INSERT INTO vault_meta (
        id,
        salt,
        password_hash
      )
      VALUES (1, ?, ?)
    `).run(
      meta.salt,
      meta.passwordHash
    )

    this.sessionKey = makeSessionKey(masterPassword, meta.salt)

    const recoveryKey = this.createOrReplaceRecoveryKey()

    return {
      success: true,
      recoveryKey
    }
  }

  registerUnlockFailure() {
    const now = Date.now()

    this.unlockFailures = this.unlockFailures.filter(
      (ts) => now - ts < 15 * 60 * 1000
    )

    this.unlockFailures.push(now)

    if (this.unlockFailures.length >= 5) {
      this.unlockBlockedUntil = now + 10000
    } else if (this.unlockFailures.length >= 3) {
      this.unlockBlockedUntil = now + 3000
    }
  }

  clearUnlockFailures() {
    this.unlockFailures = []
    this.unlockBlockedUntil = 0
  }

  assertUnlockNotBlocked() {
    const now = Date.now()

    if (this.unlockBlockedUntil > now) {
      const seconds = Math.ceil(
        (this.unlockBlockedUntil - now) / 1000
      )

      throw new Error(
        `Muitas tentativas inválidas. Aguarde ${seconds}s.`
      )
    }
  }

  unlock(masterPassword) {
    this.assertUnlockNotBlocked()

    const meta = this.db.prepare(`
      SELECT salt, password_hash
      FROM vault_meta
      WHERE id = 1
    `).get()

    if (!meta) {
      throw new Error('Cofre ainda não foi criado.')
    }

    const valid = verifyMasterPassword(
      masterPassword,
      meta.salt,
      meta.password_hash
    )

    if (!valid) {
      this.registerUnlockFailure()
      throw new Error('Chave mestra inválida.')
    }

    this.clearUnlockFailures()

    this.sessionKey = makeSessionKey(
      masterPassword,
      meta.salt
    )

    return { success: true }
  }

  normalizeItemType(type) {
    return ['password', 'text'].includes(type)
      ? type
      : 'password'
  }

  getCredentialRow(id) {
    const row = this.db.prepare(`
      SELECT *
      FROM credentials
      WHERE id = ?
    `).get(id)

    if (!row) {
      throw new Error('Item não encontrado.')
    }

    return row
  }

  readSecurePayload(row, key = this.sessionKey) {
    try {
      return decryptJson(
        JSON.parse(row.encrypted_payload),
        key
      )
    } catch {
      return {}
    }
  }

  toCredentialSummary(row) {
    const secure = this.readSecurePayload(row)

    const itemType = this.normalizeItemType(
      secure.itemType
    )

    return {
      id: row.id,
      title: row.title,
      username: row.username || '',
      email: row.email || '',
      website: row.website || '',
      category: row.category || '',
      notes: row.notes || '',
      itemType,
      hasSecretText: Boolean(secure.secretText),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  toCredentialFull(row) {
    const secure = this.readSecurePayload(row)

    return {
      ...this.toCredentialSummary(row),
      password: secure.password || '',
      secretText: secure.secretText || ''
    }
  }

  listCredentials() {
    this.requireUnlocked()

    const rows = this.db.prepare(`
      SELECT *
      FROM credentials
      ORDER BY updated_at DESC, id DESC
    `).all()

    return rows.map((row) =>
      this.toCredentialSummary(row)
    )
  }

  getCredentialForEdit(id) {
    this.requireUnlocked()

    const row = this.getCredentialRow(id)

    return {
      success: true,
      credential: this.toCredentialFull(row)
    }
  }

  revealPassword(id) {
    this.requireUnlocked()

    const row = this.getCredentialRow(id)
    const secure = this.readSecurePayload(row)

    if (this.normalizeItemType(secure.itemType) !== 'password') {
      return {
        success: true,
        password: ''
      }
    }

    return {
      success: true,
      password: secure.password || ''
    }
  }

  saveCredential(input) {
    this.requireUnlocked()

    if (!input.title?.trim()) {
      throw new Error('Informe um título.')
    }

    const itemType = this.normalizeItemType(input.itemType)

    const payload = {
      itemType,
      password: itemType === 'password' ? input.password || '' : '',
      secretText: itemType === 'text' ? input.secretText || '' : ''
    }

    const encrypted = JSON.stringify(
      encryptJson(payload, this.sessionKey)
    )

    const now = new Date().toISOString()

    const username = itemType === 'password' ? input.username || '' : ''
    const email = itemType === 'password' ? input.email || '' : ''

    if (input.id) {
      this.db.prepare(`
        UPDATE credentials
        SET
          title = ?,
          username = ?,
          email = ?,
          website = ?,
          category = ?,
          notes = ?,
          encrypted_payload = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        input.title.trim(),
        username,
        email,
        input.website || '',
        input.category || '',
        input.notes || '',
        encrypted,
        now,
        input.id
      )

      return { success: true }
    }

    this.db.prepare(`
      INSERT INTO credentials (
        title,
        username,
        email,
        website,
        category,
        notes,
        encrypted_payload,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.title.trim(),
      username,
      email,
      input.website || '',
      input.category || '',
      input.notes || '',
      encrypted,
      now,
      now
    )

    return { success: true }
  }

  deleteCredential(id) {
    this.requireUnlocked()

    this.db.prepare(`
      DELETE FROM credentials
      WHERE id = ?
    `).run(id)

    return { success: true }
  }

  buildBackupPayload() {
    this.requireUnlocked()

    const rows = this.db.prepare(`
      SELECT *
      FROM credentials
    `).all()

    const entries = rows.map((row) =>
      this.toCredentialFull(row)
    )

    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      entries
    }
  }

  async exportBackup() {
    this.requireUnlocked()

    const backup = encryptJson(
      this.buildBackupPayload(),
      this.sessionKey
    )

    const result = await dialog.showSaveDialog({
      defaultPath: path.join(
        app.getPath('documents'),
        `vaulty-backup-${Date.now()}.vaulty`
      )
    })

    if (result.canceled) {
      return { success: false }
    }

    fs.writeFileSync(
      result.filePath,
      JSON.stringify(backup, null, 2)
    )

    return { success: true }
  }

  async importBackup() {
    this.requireUnlocked()

    const result = await dialog.showOpenDialog({
      properties: ['openFile']
    })

    if (result.canceled) {
      return { success: false }
    }

    const raw = fs.readFileSync(
      result.filePaths[0],
      'utf8'
    )

    const backup = decryptJson(
      JSON.parse(raw),
      this.sessionKey
    )

    let imported = 0

    for (const item of backup.entries || []) {
      this.saveCredential({
        title: item.title || 'Item importado',
        username: item.username || '',
        email: item.email || '',
        website: item.website || '',
        category: item.category || '',
        notes: item.notes || '',
        itemType: this.normalizeItemType(item.itemType),
        password: item.password || '',
        secretText: item.secretText || ''
      })

      imported++
    }

    return {
      success: true,
      imported
    }
  }

  getAppSetting(key) {
    const row = this.db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(key)

    return row ? row.value : null
  }

  setAppSetting(key, value) {
    this.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key)
      DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, value)
  }

  deleteAppSetting(key) {
    this.db.prepare(`
      DELETE FROM app_settings
      WHERE key = ?
    `).run(key)
  }

  getDriveConfig() {
    this.requireUnlocked()

    const raw = this.getAppSetting('google_drive_config')
    if (!raw) {
      return null
    }

    try {
      return decryptJson(JSON.parse(raw), this.sessionKey)
    } catch {
      throw new Error('Não foi possível ler a configuração do Google Drive.')
    }
  }

  saveDriveSettings(input) {
    this.requireUnlocked()

    if (!input.clientId?.trim()) {
      throw new Error('Informe o Client ID.')
    }

    if (!input.clientSecret?.trim()) {
      throw new Error('Informe o Client Secret.')
    }

    if (!input.refreshToken?.trim()) {
      throw new Error('Informe o Refresh Token.')
    }

    const config = {
      clientId: input.clientId.trim(),
      clientSecret: input.clientSecret.trim(),
      refreshToken: input.refreshToken.trim(),
      folderName: (input.folderName || 'Vaulty').trim() || 'Vaulty',
      reminderEnabled: Boolean(input.reminderEnabled)
    }

    const encrypted = encryptJson(config, this.sessionKey)

    this.setAppSetting('google_drive_config', JSON.stringify(encrypted))
    this.setAppSetting('google_drive_reminder_enabled', config.reminderEnabled ? '1' : '0')

    return { success: true }
  }

  getDriveSettings() {
    this.requireUnlocked()

    const config = this.getDriveConfig()

    if (!config) {
      return {
        success: true,
        settings: {
          clientId: '',
          clientSecret: '',
          refreshToken: '',
          folderName: 'Vaulty',
          reminderEnabled: true
        }
      }
    }

    return {
      success: true,
      settings: {
        clientId: config.clientId || '',
        clientSecret: config.clientSecret || '',
        refreshToken: config.refreshToken || '',
        folderName: config.folderName || 'Vaulty',
        reminderEnabled: config.reminderEnabled !== false
      }
    }
  }

  getDriveStatus() {
    this.requireUnlocked()

    const raw = this.getAppSetting('google_drive_config')
    const lastSyncAt = this.getAppSetting('google_drive_last_sync_at') || ''
    const reminderEnabled = this.getAppSetting('google_drive_reminder_enabled') !== '0'

    let dueNow = false
    if (raw && lastSyncAt) {
      const last = new Date(lastSyncAt).getTime()
      dueNow = Number.isFinite(last) && (Date.now() - last >= 3 * 24 * 60 * 60 * 1000)
    } else if (raw) {
      dueNow = true
    }

    return {
      success: true,
      configured: Boolean(raw),
      lastSyncAt,
      reminderEnabled,
      dueNow
    }
  }

  async syncDriveNow() {
    this.requireUnlocked()

    const config = this.getDriveConfig()
    if (!config) {
      throw new Error('Configure o Google Drive antes de sincronizar.')
    }

    const backupPayload = this.buildBackupPayload()
    const encrypted = encryptJson(backupPayload, this.sessionKey)
    const content = JSON.stringify(encrypted, null, 2)

    const result = await uploadBackupToDrive(config, content)

    const now = new Date().toISOString()
    this.setAppSetting('google_drive_last_sync_at', now)
    this.setAppSetting('google_drive_last_file_name', result.fileName || BACKUP_FILENAME)
    this.setAppSetting('google_drive_last_file_id', result.fileId || '')
    this.setAppSetting('google_drive_last_folder_id', result.folderId || '')

    return {
      success: true,
      syncedAt: now,
      fileName: result.fileName || BACKUP_FILENAME
    }
  }

  makeRecoveryCryptoKey(recoveryKey, saltHex) {
    const recoveryHash = hashRecoveryKey(recoveryKey, saltHex)
    return Buffer.from(recoveryHash.slice(0, 64), 'hex')
  }

  getRecoveryStatus() {
    const hasRecoveryKey = Boolean(
      this.getAppSetting('recovery_key_hash') &&
      this.getAppSetting('recovery_key_salt') &&
      this.getAppSetting('recovery_key_wrap')
    )

    return {
      success: true,
      hasRecoveryKey
    }
  }

  createOrReplaceRecoveryKey() {
    this.requireUnlocked()

    const recoveryKey = createRecoveryKey()
    const recoverySalt = crypto.randomBytes(16).toString('hex')
    const recoveryHash = hashRecoveryKey(recoveryKey, recoverySalt)
    const recoveryCryptoKey = this.makeRecoveryCryptoKey(recoveryKey, recoverySalt)

    const wrapPayload = {
      sessionKeyHex: this.sessionKey.toString('hex'),
      createdAt: new Date().toISOString()
    }

    const encryptedWrap = encryptJson(wrapPayload, recoveryCryptoKey)

    this.setAppSetting('recovery_key_salt', recoverySalt)
    this.setAppSetting('recovery_key_hash', recoveryHash)
    this.setAppSetting('recovery_key_wrap', JSON.stringify(encryptedWrap))
    this.setAppSetting('recovery_key_created_at', new Date().toISOString())

    return recoveryKey
  }

  generateRecoveryKey() {
    this.requireUnlocked()

    const recoveryKey = this.createOrReplaceRecoveryKey()

    return {
      success: true,
      recoveryKey
    }
  }

  recoverWithRecoveryKey(input) {
    const recoveryKey = normalizeRecoveryKey(input?.recoveryKey)
    const newMasterPassword = input?.newMasterPassword || ''

    if (!recoveryKey) {
      throw new Error('Informe a chave de recuperação.')
    }

    if (!newMasterPassword || newMasterPassword.length < 8) {
      throw new Error('A nova chave mestra precisa ter pelo menos 8 caracteres.')
    }

    const recoverySalt = this.getAppSetting('recovery_key_salt')
    const recoveryHash = this.getAppSetting('recovery_key_hash')
    const recoveryWrapRaw = this.getAppSetting('recovery_key_wrap')

    if (!recoverySalt || !recoveryHash || !recoveryWrapRaw) {
      throw new Error('Este cofre ainda não possui chave de recuperação.')
    }

    const validRecovery = verifyRecoveryKey(
      recoveryKey,
      recoverySalt,
      recoveryHash
    )

    if (!validRecovery) {
      throw new Error('Chave de recuperação inválida.')
    }

    const recoveryCryptoKey = this.makeRecoveryCryptoKey(recoveryKey, recoverySalt)

    let oldSessionKey

    try {
      const wrapPayload = decryptJson(
        JSON.parse(recoveryWrapRaw),
        recoveryCryptoKey
      )

      oldSessionKey = Buffer.from(wrapPayload.sessionKeyHex, 'hex')
    } catch {
      throw new Error('Não foi possível abrir a chave de recuperação.')
    }

    const newMeta = createVaultMetadata(newMasterPassword)
    const newSessionKey = makeSessionKey(newMasterPassword, newMeta.salt)

    const transaction = this.db.transaction(() => {
      const rows = this.db.prepare(`
        SELECT id, encrypted_payload
        FROM credentials
      `).all()

      const updateCredential = this.db.prepare(`
        UPDATE credentials
        SET encrypted_payload = ?, updated_at = ?
        WHERE id = ?
      `)

      const now = new Date().toISOString()

      for (const row of rows) {
        const payload = decryptJson(
          JSON.parse(row.encrypted_payload),
          oldSessionKey
        )

        const encrypted = JSON.stringify(
          encryptJson(payload, newSessionKey)
        )

        updateCredential.run(encrypted, now, row.id)
      }

      const driveRaw = this.getAppSetting('google_drive_config')
      if (driveRaw) {
        const driveConfig = decryptJson(
          JSON.parse(driveRaw),
          oldSessionKey
        )

        this.setAppSetting(
          'google_drive_config',
          JSON.stringify(encryptJson(driveConfig, newSessionKey))
        )
      }

      this.db.prepare(`
        UPDATE vault_meta
        SET salt = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        newMeta.salt,
        newMeta.passwordHash
      )
    })

    transaction()

    this.sessionKey = newSessionKey

    const newRecoveryKey = this.createOrReplaceRecoveryKey()

    return {
      success: true,
      recoveryKey: newRecoveryKey
    }
  }
}

module.exports = {
  VaultService
}