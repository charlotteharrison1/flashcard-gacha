import { supabase } from './supabase'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const BUCKET = 'uploads'

function extOf(file: File) {
  return /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? 'jpg'
}

/**
 * Uploads an image under the current user's folder. Returns both the full public URL (for
 * places like a deck icon, stored and rendered directly) and `path`, the part after the user's
 * own id — e.g. "cards/<uuid>.png" — for anything inserted into editable card text, so what you
 * see while typing isn't your account id and the full storage domain spelled out.
 */
export async function uploadImage(file: File, folder: string): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 5 MB.')

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in.')

  const relPath = `${folder}/${crypto.randomUUID()}.${extOf(file)}`
  const fullPath = `${auth.user.id}/${relPath}`
  const { error } = await supabase.storage.from(BUCKET).upload(fullPath, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const url = supabase.storage.from(BUCKET).getPublicUrl(fullPath).data.publicUrl
  return { url, path: relPath }
}

/** Expands a short relative path (see `uploadImage`) back into a real URL for the given user. A
 *  value that's already a full http(s)/data URL — from before this change — passes through as-is. */
export function resolveImagePath(userId: string, src: string): string {
  if (/^(https?:|data:)/i.test(src)) return src
  return supabase.storage.from(BUCKET).getPublicUrl(`${userId}/${src}`).data.publicUrl
}
