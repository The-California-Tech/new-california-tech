type ThumbnailPreset = {
	width: number;
	height: number;
	quality: number;
	format: 'webp' | 'avif' | 'jpeg' | 'png';
};

const SUPABASE_HOST_SNIPPET = 'supabase.co';

const APP_THUMBNAIL_PRESET: ThumbnailPreset = {
	width: 640,
	height: 480,
	quality: 72,
	format: 'webp'
};

function canUseSupabaseTransform(url: string): boolean {
	return url.includes(SUPABASE_HOST_SNIPPET);
}

export function getAppThumbnailUrl(coverUrl?: string): string | undefined {
	if (!coverUrl) {
		return undefined;
	}

	if (!canUseSupabaseTransform(coverUrl)) {
		return coverUrl;
	}

	try {
		const url = new URL(coverUrl);
		url.searchParams.set('width', String(APP_THUMBNAIL_PRESET.width));
		url.searchParams.set('height', String(APP_THUMBNAIL_PRESET.height));
		url.searchParams.set('quality', String(APP_THUMBNAIL_PRESET.quality));
		url.searchParams.set('format', APP_THUMBNAIL_PRESET.format);
		return url.toString();
	} catch {
		return coverUrl;
	}
}
