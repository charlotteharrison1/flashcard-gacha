import { supabase } from './supabase'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const BUCKET = 'uploads'

function extOf(file: File) {
  return /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? 'jpg'
}

/** Uploads an image under the current user's folder and returns its public URL. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 5 MB.')

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in.')

  const path = `${auth.user.id}/${folder}/${crypto.randomUUID()}.${extOf(file)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
