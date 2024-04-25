import mime from "mime";

/**
 * Maps a regular path to the correct index.html file.
 * @param url The URL to map.
 * @returns The mapped URL.
 */
const mapRegularPath = (url: URL) => {
	// / -> index.html
	if (url.pathname.endsWith("/")) {
		return url.pathname + "index.html";
	}
	// /example -> /example/index.html
	else if (mime.getType(url.pathname) === null) {
		return url.pathname + "/index.html";
	}
	return url.pathname;
};

/**
 * The SPA mode to use when looking up a static asset.
 * - "root-index" - Always serve the root index.html file, regardless of the file path.
 * - "off" - Normal static asset lookup.
 */
export type SpaMode = "root-index" | "off";

/**
 * Options for looking up a static asset.
 * - spaMode - The SPA mode to use when looking up the asset.
 * - overridePath - The path to override the lookup with. If not specified, it will be constructed from the URL.
 */
export type LookupAssetOptions = {
	spaMode?: SpaMode;
	overridePath?: string;
};

/**
 * Looks up a path to a static asset in the provided asset manifest.
 * @param request The incoming request.
 * @param manifest The asset manifest to look up the asset in. Should be imported from the generated manifest.
 * @param options The options to use when looking up the asset. See {@link LookupAssetOptions} for more information.
 * @returns The asset response if found, otherwise null.
 */
export const lookupStaticAsset = (
	request: Request,
	manifest: any[],
	options: LookupAssetOptions = {}
): Response | null => {
	const url = new URL(request.url);

	// Construct the asset lookup path.
	let finalPath: string;
	if (options.overridePath != null) {
		finalPath = options.overridePath;
	} else if (
		options.spaMode === "root-index" &&
		mime.getType(url.pathname) === null
	) {
		finalPath = "/index.html";
	} else {
		finalPath = mapRegularPath(url);
	}

	// Look up the mime type.
	let mimeType = mime.getType(finalPath) || "application/octet-stream";
	if (mimeType.startsWith("text") || mimeType === "application/javascript") {
		mimeType += "; charset=utf-8";
	}

	// Find is faster than manual loop.
	// Ref: https://stackoverflow.com/questions/50843682/for-loop-with-break-vs-find-in-javascript
	const found = manifest.find((asset) => asset.p === finalPath);
	if (found != null) {
		// Check if the ETag matches. If so, just return a 304.
		const etag = request.headers.get("If-None-Match");
		if (etag === `"${found.e}"`) {
			return new Response(null, {
				status: 304,
				headers: {
					"Content-Type": mimeType,
					"Content-Encoding": "br",
					// We don't support range requests, so just disable them.
					"Accept-Ranges": "none",
					ETag: `"${found.e}"`,
				},
			});
		}

		// Decode data from base64.
		const data = Uint8Array.from(atob(found.d), (c) => c.charCodeAt(0));

		return new Response(data, {
			status: 200,
			headers: {
				"Content-Type": mimeType,
				"Content-Length": data.length.toString(),
				"Content-Encoding": "br",
				// We don't support range requests, so just disable them.
				"Accept-Ranges": "none",
				ETag: `"${found.e}"`,
			},

			// Skip decompression, Cloudflare will handle decompression if the client doesn't support it
			// and if they do then we can avoid an extra decompress -> recompress step.
			// @ts-expect-error TS doesn't know about the encodeBody property.
			encodeBody: "manual",
		});
	}
	return null;
};
