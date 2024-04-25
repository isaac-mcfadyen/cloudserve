import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import mime from "mime";

const diskPathToUrl = (diskPath: string, rootFolder: string) => {
	const relativeUrl = path.relative(rootFolder, diskPath);
	return "/" + relativeUrl.replace(/\\/g, "/");
};
const generateImportName = (filePath: string) => {
	return "_" + path.basename(filePath).replace(/\./g, "_").replace(/-/g, "_");
};

type FileList = {
	importName: string;
	diskPath: string;
	urlPath: string;
	mimeType: string;
};
export const getFileList = async (
	rootFolder: string,
	subfolder?: string,
	fileList: FileList[] = []
): Promise<FileList[]> => {
	if (subfolder == null) subfolder = rootFolder;
	const files = await fs.readdir(subfolder);
	for (const file of files) {
		const filePath = path.join(subfolder, file);
		const metadata = await fs.stat(filePath);
		if (metadata.isDirectory()) {
			await getFileList(rootFolder, filePath, fileList);
		} else {
			const diskPath = path.resolve(filePath);
			const urlPath = diskPathToUrl(diskPath, rootFolder);
			fileList.push({
				importName: generateImportName(filePath),
				diskPath: diskPath,
				urlPath: urlPath,
				mimeType: mime.getType(filePath) || "application/octet-stream",
			});
		}
	}
	return fileList;
};
