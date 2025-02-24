/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TAbstractFile, TFile, TFolder, App } from "obsidian";

export function isIndexFile(file: TAbstractFile) {
	return file instanceof TFile && file.basename === file.parent?.name;
}
function parentPrefix(file: TFile) {
	return folderPrefix(file.parent!);
}
export function getParentPath(p: string) {
	return p === "/" ? undefined : p.split("/").slice(0, -1).join("/") || "/";
}
export function isIndexPath(path: string) {
	// always non null, because actual signature should be [string, ...string[]]
	const basename = path.split("/").at(-1)!;
	const dirname = path.split("/").slice(0, -1).join("/") || undefined;
	const dirBasename = dirname?.split("/").at(-1);
	return !!dirBasename && dirBasename === basename;
}
export function folderPrefix(file: TFolder) {
	return file.path === "/" ? "" : `${file.path}/`;
}
export async function forceFolder(file: TAbstractFile, app: App) {
	if (file instanceof TFile) {
		if (isIndexFile(file)) {
			return { folder: file.parent!, index: file };
		}
		const fileParentPrefix = parentPrefix(file);

		const folder = await app.vault.createFolder(
			fileParentPrefix + file.basename,
		);
		const indexPath = `${folder.path}/${file.name}`;
		await app.fileManager.renameFile(file, indexPath);
		return {
			folder,
			index: app.vault.getAbstractFileByPath(indexPath) as TFile,
		};
	}
	if (file instanceof TFolder) {
		const indexPath = `${file.path}/${file.name}`;
		return {
			folder: file,
			index: app.vault.getAbstractFileByPath(indexPath) as TFile, // unsound
		};
	}
	throw new Error("Impossible");
}
export function movableFile(file: null | undefined): null | undefined;
export function movableFile(file: TFile | TFolder): TFile | TFolder;
export function movableFile(
	file: TFile | TFolder | undefined | null,
): TFile | TFolder | undefined | null;
export function movableFile(file: TFile | TFolder | undefined | null) {
	return file instanceof TFile && isIndexFile(file) ? file.parent! : file;
}
export async function forceFile(file: TFile, app: App) {
	if (file.extension === "dir") {
		const fileParentPrefix = parentPrefix(file);

		const indexFile = await app.vault.create(
			fileParentPrefix + file.basename + ".md",
			"",
		);
		return indexFile;
	}
	return file;
}
