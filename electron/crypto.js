const crypto = require('crypto')

const KEY_LENGTH = 32
const SALT_LENGTH = 16
const IV_LENGTH = 12

function deriveKey(masterPassword, salt) {
  return crypto.scryptSync(masterPassword, salt, KEY_LENGTH)
}

function hashMasterPassword(masterPassword, salt) {
  return crypto.scryptSync(masterPassword, salt, 64).toString('hex')
}

function encryptJson(payload, key) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

function decryptJson(payload, key) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, 'hex')),
    decipher.final()
  ])
  return JSON.parse(decrypted.toString('utf8'))
}

function createVaultMetadata(masterPassword) {
  const salt = crypto.randomBytes(SALT_LENGTH)
  return {
    salt: salt.toString('hex'),
    passwordHash: hashMasterPassword(masterPassword, salt)
  }
}

function verifyMasterPassword(masterPassword, saltHex, expectedHash) {
  const salt = Buffer.from(saltHex, 'hex')
  const computed = hashMasterPassword(masterPassword, salt)
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expectedHash, 'hex'))
}

function makeSessionKey(masterPassword, saltHex) {
  return deriveKey(masterPassword, Buffer.from(saltHex, 'hex'))
}

module.exports = {
  encryptJson,
  decryptJson,
  createVaultMetadata,
  verifyMasterPassword,
  makeSessionKey
}
