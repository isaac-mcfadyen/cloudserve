import { program } from "commander";
import ora from "ora";
import fs from "node:fs/promises";
import { getFileList } from "./files.js";
import { promisify } from "node:util";
import zlib from "node:zlib";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

const brotliCompress = promisify(zlib.brotliCompress);

const cli = program
	.name("cloudserve")
	.version("1.0.5")
	.description(
		"🌎 Bundle assets for use with a globally distributed Cloudflare Worker."
	);

cli
	.argument("<folder>", "The folder of assets to bundle")
	.argument(
		"<output>",
		"The path to store the manifest file, which is needed when deploying to Cloudflare Workers"
	)
	.action(async (folder: string, outfile: string) => {
		// Make sure the input folder exists.
		try {
			const metadata = await fs.stat(folder);
			if (!metadata.isDirectory()) {
				ora().fail(`"${folder}" is not a folder, exiting.`);
				process.exit(1);
			}
		} catch (_) {
			ora().fail(`Folder "${folder}" does not exist, exiting.`);
			process.exit(1);
		}

		// Make sure the output file is a TS file.
		if (path.extname(outfile) !== ".ts") {
			ora().fail(`Output file must be a .ts file, exiting.`);
			process.exit(1);
		}

		const spinner = ora("Bundling files").start();

		// Construct URLPatterns for matching.
		const fileList = await getFileList(folder);

		// Open a temp file.
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sites-v2-"));
		const tempFile = path.join(tempDir, "output.js");
		const file = await fs.open(tempFile, "w");

		// Inline each file as binary into the template.
		await file.write("export const __STATIC_FILES = [\n");
		for (const importFile of fileList) {
			const data = await fs.readFile(importFile.diskPath);
			const compressed = await brotliCompress(data, {
				params: {
					// 9 is realistically the highest we can go,
					// anything higher and the bundle time is quite noticeable.
					[zlib.constants.BROTLI_PARAM_QUALITY]: 9,
				},
			});

			// Calculate a strong etag.
			const strongEtag = crypto
				.createHash("sha256")
				.update(compressed)
				.digest("hex");
			const base64 = compressed.toString("base64");

			await file.write(
				`{p:"${importFile.urlPath}",d:"${base64}",e:"${strongEtag}"},`
			);
		}
		await file.write("]");
		await file.write(" as {p: string; d: string; e: string;}[];\n");
		await file.close();

		// Get the file size.
		const metadata = await fs.stat(tempFile);
		const MAX_FILE_SIZE = 25 * 1024 * 1024; // Max file size on Workers is 25MB
		if (metadata.size > MAX_FILE_SIZE) {
			spinner.warn(
				`Bundling succeeded but the output file is larger than 25MB (${(
					metadata.size /
					1024 /
					1024
				).toFixed(2)} MB). Deployment may fail.`
			);
		}

		await fs.copyFile(tempFile, outfile);
		spinner.succeed("Bundled files.");
	});

cli.parse();
