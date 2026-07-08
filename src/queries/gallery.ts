import { db } from '../db'
import { fanartGallery } from '../db/schema'

export async function addFanartImage(fileId: string, artistName: string) {
    await db.insert(fanartGallery).values({
        fileId,
        artistName,
        createdAt: new Date(),
    })
}

export async function getFanartImages() {
    return await db.query.fanartGallery.findMany({
        orderBy: (t, {desc}) => [desc(t.createdAt)],
    })
}