const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
const GOOGLE_DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const BACKUP_FILENAME = 'vaulty-latest.vaulty'

function escapeDriveQuery(value) {
  return String(value || '').replace(/'/g, "\\'")
}

async function parseGoogleResponse(response) {
  const text = await response.text()

  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    const message =
      data?.error_description ||
      data?.error?.message ||
      data?.raw ||
      'Erro ao comunicar com o Google Drive.'
    throw new Error(message)
  }

  return data
}

async function getAccessToken(config) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token'
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  const data = await parseGoogleResponse(response)

  if (!data.access_token) {
    throw new Error('Não foi possível obter access token do Google.')
  }

  return data.access_token
}

async function driveRequest(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  })

  return parseGoogleResponse(response)
}

async function findFolder(accessToken, folderName) {
  const query = encodeURIComponent(
    `mimeType='${FOLDER_MIME}' and trashed=false and name='${escapeDriveQuery(folderName)}'`
  )

  const url = `${GOOGLE_DRIVE_API}/files?q=${query}&fields=files(id,name)&pageSize=10`
  const data = await driveRequest(accessToken, url)

  return data.files?.[0] || null
}

async function createFolder(accessToken, folderName) {
  const body = {
    name: folderName,
    mimeType: FOLDER_MIME
  }

  return driveRequest(accessToken, `${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

async function findOrCreateFolder(accessToken, folderName) {
  const existing = await findFolder(accessToken, folderName)
  if (existing) return existing
  return createFolder(accessToken, folderName)
}

async function findBackupFile(accessToken, folderId, fileName = BACKUP_FILENAME) {
  const query = encodeURIComponent(
    `trashed=false and name='${escapeDriveQuery(fileName)}' and '${folderId}' in parents`
  )

  const url = `${GOOGLE_DRIVE_API}/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=10`
  const data = await driveRequest(accessToken, url)

  return data.files?.[0] || null
}

function buildMultipartBody(metadata, content) {
  const boundary = `vaulty-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const delimiter = `--${boundary}`
  const closeDelimiter = `--${boundary}--`

  const body =
    `${delimiter}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `${delimiter}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `${closeDelimiter}`

  return {
    boundary,
    body
  }
}

async function uploadNewBackup(accessToken, folderId, content, fileName = BACKUP_FILENAME) {
  const metadata = {
    name: fileName,
    parents: [folderId]
  }

  const multipart = buildMultipartBody(metadata, content)

  return driveRequest(
    accessToken,
    `${GOOGLE_DRIVE_UPLOAD_API}?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${multipart.boundary}`
      },
      body: multipart.body
    }
  )
}

async function updateBackup(accessToken, fileId, content, fileName = BACKUP_FILENAME) {
  const metadata = {
    name: fileName
  }

  const multipart = buildMultipartBody(metadata, content)

  return driveRequest(
    accessToken,
    `${GOOGLE_DRIVE_UPLOAD_API}/${fileId}?uploadType=multipart`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': `multipart/related; boundary=${multipart.boundary}`
      },
      body: multipart.body
    }
  )
}

async function uploadBackupToDrive(config, content) {
  const accessToken = await getAccessToken(config)
  const folder = await findOrCreateFolder(accessToken, config.folderName || 'Vaulty')
  const existingFile = await findBackupFile(accessToken, folder.id)

  let file
  if (existingFile) {
    file = await updateBackup(accessToken, existingFile.id, content)
  } else {
    file = await uploadNewBackup(accessToken, folder.id, content)
  }

  return {
    folderId: folder.id,
    fileId: file.id,
    fileName: file.name || BACKUP_FILENAME
  }
}

module.exports = {
  uploadBackupToDrive,
  BACKUP_FILENAME
}