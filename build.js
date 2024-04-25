import { build } from "esbuild";

await build({
	outdir: "./dist/cli",
	entryPoints: ["./src/cli.ts"],
	target: "node16",
	platform: "node",
	format: "esm",
	bundle: true,
	minify: true,
	sourcemap: true,
	banner: {
		js: `
            import { createRequire } from 'module';
            const require = createRequire(import.meta.url);
        `,
	},
});
