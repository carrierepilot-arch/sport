import crypto from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function getSecret(): string {
  return process.env.MESSAGE_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback_secret_change_me';
}

function getKey(): Buffer {
  return crypto.createHash('sha256').update(getSecret()).digest();
}

export function encryptMessageContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) return normalized;
  if (normalized.startsWith(ENCRYPTED_PREFIX)) return normalized;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('');
}

export function decryptMessageContent(content: string | null | undefined): string {
  if (!content) return '';
  if (!content.startsWith(ENCRYPTED_PREFIX)) return content;

  try {
    const payload = content.slice(ENCRYPTED_PREFIX.length);
    const [ivRaw, tagRaw, encryptedRaw] = payload.split(':');
    if (!ivRaw || !tagRaw || !encryptedRaw) return '[message indisponible]';

    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivRaw, 'base64'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    return '[message indisponible]';
  }
}

export function buildMessagePreview(content: string | null | undefined, maxLength = 50): string {
  const decrypted = decryptMessageContent(content).replace(/\s+/g, ' ').trim();
  if (!decrypted) return '';
  // Handle special content markers
  if (decrypted.startsWith('__WORKOUT_SHARE__')) return 'Programme d\'entrainement partage';
  if (decrypted.startsWith('__IMAGE__')) return 'Image';
  if (decrypted.startsWith('__VIDEO__')) return 'Video';
  return decrypted.length > maxLength ? `${decrypted.slice(0, maxLength)}...` : decrypted;
}