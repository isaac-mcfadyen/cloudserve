# cloudserve

Run small websites embedded in a Cloudflare Worker.

## Install

Globally:

```
npm install -g cloudserve
```

Per-project:

```
npm install cloudserve
```

## Usage

`cloudserve` can either be run manually or as part of a Wrangler build command.

Manually:

```bash
cloudserve ./path/to/website ./manifest.ts
```

With Wrangler (add to your existing `wrangler.toml` file):

```bash
[build]
command = "sites-v2 ./path/to/website ./manifest.ts"
```

An example Worker that uses the created manifest and serves static files, falling back to 404 if not found:

```typescript
import { __STATIC_FILES } from "./manifest";
import { lookupStaticAsset } from "cloudserve";

export default {
	async fetch(req: Request, _: never, __: never) {
		const file = lookupStaticAsset(req, __STATIC_FILES);
		if (file != null) {
			return file;
		}

		return lookupStaticAsset(req, __STATIC_FILES, {
			overridePath: "/404.html",
		});
	},
};
```
