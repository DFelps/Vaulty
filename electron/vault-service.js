const fs = require('fs')
const path = require('path')
const { dialog, app } = require('electron')
const { initializeDatabase } = require('./database')
const {
  encryptJson,
  decryptJson,
  createVaultMetadata,
  verifyMasterPassword,
  makeSessionKey
} = require('./crypto')

class VaultService {
  constructor() {
    this.db = initializeDatabase()
    this.sessionKey = null
  }

  getStatus() {
    const row = this.db.prepare('SELECT id FROM vault_meta WHERE id = 1').get()
    return {
      hasVault: Boolean(row),
      unlocked: Boolean(this.sessionKey)
    }
  }

  createVault(masterPassword) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('A chave mestra precisa ter pelo menos 8 caracteres.')
    }

    const existing = this.db.prepare('SELECT id FROM vault_meta WHERE id = 1').get()
    if (existing) {
      throw new Error('O cofre já foi criado.')
    }

    const meta = createVaultMetadata(masterPassword)

    this.db.prepare(`
      INSERT INTO vault_meta (id, salt, password_hash)
      VALUES (1, ?, ?)
    `).run(meta.salt, meta.passwordHash)

    this.sessionKey = makeSessionKey(masterPassword, meta.salt)

    return { success: true }
  }

  unlock(masterPassword) {
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
      throw new Error('Chave mestra inválida.')
    }

    this.sessionKey = makeSessionKey(masterPassword, meta.salt)

    return { success: true }
  }

  lock() {
    this.sessionKey = null
    return { success: true }
  }

  requireUnlocked() {
    if (!this.sessionKey) {
      throw new Error('Cofre bloqueado.')
    }
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

  readSecurePayload(row) {
    try {
      return decryptJson(
        JSON.parse(row.encrypted_payload),
        this.sessionKey
      )
    } catch {
      return {}
    }
  }

  normalizeAttachments(raw) {
    if (!Array.isArray(raw)) return []

    return raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        name: item.name || 'arquivo',
        type: item.type || 'application/octet-stream',
        size: Number(item.size || 0),
        data: item.data || ''
      }))
      .filter((item) => item.data)
  }

  normalizeItemType(value) {
    return ['password', 'text', 'file'].includes(value) ? value : 'password'
  }

  toCredentialSummary(row) {
    const secure = this.readSecurePayload(row)
    const itemType = this.normalizeItemType(secure.itemType)
    const attachments = this.normalizeAttachments(secure.attachments)

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
      attachmentCount: attachments.length,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  toCredentialFull(row) {
    const secure = this.readSecurePayload(row)
    const attachments = this.normalizeAttachments(secure.attachments)
    const itemType = this.normalizeItemType(secure.itemType)

    return {
      ...this.toCredentialSummary(row),
      itemType,
      password: secure.password || '',
      secretText: secure.secretText || '',
      attachments
    }
  }

  listCredentials() {
    this.requireUnlocked()

    const rows = this.db.prepare(`
      SELECT *
      FROM credentials
      ORDER BY updated_at DESC, id DESC
    `).all()

    return rows.map((row) => this.toCredentialSummary(row))
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
      return { success: true, password: '' }
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
      password: itemType === 'password' ? (input.password || '') : '',
      secretText: itemType === 'text' ? (input.secretText || '') : '',
      attachments: itemType === 'file'
        ? this.normalizeAttachments(input.attachments)
        : []
    }

    const encrypted = JSON.stringify(
      encryptJson(payload, this.sessionKey)
    )

    const now = new Date().toISOString()

    const username = itemType === 'password' ? (input.username || '') : ''
    const email = itemType === 'password' ? (input.email || '') : ''

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

  async exportBackup() {
    this.requireUnlocked()

    const rows = this.db.prepare(`
      SELECT *
      FROM credentials
    `).all()

    const entries = rows.map((row) => this.toCredentialFull(row))

    const backup = encryptJson(
      {
        version: 3,
        exportedAt: new Date().toISOString(),
        entries
      },
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

    const raw = fs.readFileSync(result.filePaths[0], 'utf8')

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
        secretText: item.secretText || '',
        attachments: this.normalizeAttachments(item.attachments)
      })
      imported++
    }

    return {
      success: true,
      imported
    }
  }
}

module.exports = {
  VaultService
}