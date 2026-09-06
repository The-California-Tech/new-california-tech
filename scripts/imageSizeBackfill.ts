/**
 * One-off backfill: populate public.image_metadata for media objects that were
 * uploaded before dimensions were recorded at upload time.
 *
 *   pnpm run backfill:image-sizes
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env -- list_storage_objects_recursive is
 * intentionally not granted to anon/authenticated.
 *
 * Newly uploaded images no longer need this: uploadImageToSupabase records
 * dimensions on both the fresh-upload and already-in-storage paths.
 */

// Relative, not '$lib/symbiont': `$lib` is a Vite alias and this script runs
// under tsx, which does not know about SvelteKit's aliases.
import { symbiont } from '../src/lib/symbiont.js';
import { imageSize } from 'image-size';
import 'dotenv/config';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
	console.error('SUPABASE_SERVICE_ROLE_KEY is not set (expected in .env).');
	process.exit(1);
}

const supabase = symbiont.getSSRClient(undefined, serviceRoleKey);

const PAGE_SIZE = 1000;

async function getDimensionsFromUrl(url: string): Promise<{ width: number; height: number } | null> {
    for (const bytes of [4096, 65536, null] as const) {
        try {
            const response = await fetch(url, bytes !== null ? { headers: { Range: `bytes=0-${bytes - 1}` } } : {});
            if (!response.ok) return null;
            const buffer = Buffer.from(await response.arrayBuffer());
            const { width, height } = imageSize(buffer);
            if (width && height) return { width, height };
        } catch (e) {
            if (bytes === null) {
                console.error(`Error getting dimensions for ${url}:`, e);
                return null;
            }
        }
    }
    return null;
}

async function backfill() {
    let lastId = 0;
    const known = new Set();

    while (true) {
        const { data, error } = await supabase
            .from('image_metadata')
            .select('id, bucket_id, object_path')
            .gt('id', lastId)
            .order('id', { ascending: true })
            .limit(PAGE_SIZE);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const r of data) {
            known.add(`${r.bucket_id}/${r.object_path}`);
        }

        lastId = data[data.length - 1].id;

        // optional: stop if last page
        if (data.length < PAGE_SIZE) break;
    }

    console.log(`Found existing image metadata for ${known.size} files`);

    let afterName: string | undefined = undefined;
    const files = [];

    while (true) {
        const { data, error } = await supabase.rpc('list_storage_objects_recursive', {
            p_bucket_id: 'media',
            p_prefix: '',
            p_limit: PAGE_SIZE,
            p_after_name: afterName,
        });

        if (error) throw error;
        if (!data || data.length === 0) break;

        files.push(...data);
        const lastFile: { name: string; id: string } = data[data.length - 1];
        afterName = lastFile.name;

        if (data.length < PAGE_SIZE) break;
    }

    const needsUpdate = (files ?? []).filter((f: { name: string; id: string }) =>
        !known.has(`media/${f.name}`) &&
        /\.\w+$/.test(f.name)
    );

    console.log(`${files.length} total files in bucket, ${needsUpdate.length} have no existing metadata`);

    for (const file of needsUpdate) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(file.name);
        const dims = await getDimensionsFromUrl(publicUrl);
        if (!dims) {
            console.warn(`  ✗ Could not get dimensions for ${file.name}`);
            continue;
        }

        const { error: upsertError } = await supabase
            .from('image_metadata')
            .upsert({
                bucket_id: 'media',
                object_path: file.name,
                storage_object_id: file.id,
                width: dims.width,
                height: dims.height,
                // Bare comma-separated list; a space makes PostgREST look for a
                // column named " object_path".
            }, { onConflict: 'bucket_id,object_path' });

        if (upsertError) {
            console.warn(`  ✗ Failed to upsert ${file.name}:`, upsertError.message);
        } else {
            console.log(`  ✓ ${file.name} → ${dims.width}×${dims.height}`);
        }
    }

    console.log('Backfill complete.');
}

backfill().catch(console.error);