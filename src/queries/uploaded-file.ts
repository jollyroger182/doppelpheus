import { db } from '../db'
import { uploadedFiles } from '../db/schema'

export const IMAGE_KEYS = ['welcome'] as const
export type ImageKey = (typeof IMAGE_KEYS)[number]

export async function getUploadedFileId(key: ImageKey): Promise<string | undefined> {
	const row = await db.query.uploadedFiles.findFirst({ where: { key } })
	return row?.fileId
}

export async function setUploadedFileId(key: ImageKey, fileId: string) {
	await db
		.insert(uploadedFiles)
		.values({ key, fileId })
		.onConflictDoUpdate({
			target: uploadedFiles.key,
			set: { fileId, updatedAt: new Date() },
		})
}
