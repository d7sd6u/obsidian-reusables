/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import uniq from "lodash-es/uniq";
import { isFrontmatterLinkCache } from "../obsidian-typings/src/obsidian/implementations/TypeGuards/isFrontmatterLinkCache";
import { isIndexFile, movableFile, forceFolder } from "./indexFiles";

export function getFileParentIndexes(file: TFile, app: App): TFile[] {
	const parentIndexes: TFile[] = [];
	const data = app.metadataCache.getBacklinksForFile(file).data;
	for (const [fileWithLinkPath, refs] of data) {
		const fileWithLink = app.vault.getAbstractFileByPath(fileWithLinkPath);
		if (
			fileWithLink &&
			fileWithLink instanceof TFile &&
			refs.some(
				(r) =>
					isFrontmatterLinkCache(r) && /^symlinks\.\d+$/.exec(r.key),
			) &&
			getFileIsTargetFileTagFilter(file, app)(fileWithLink)
		) {
			parentIndexes.push(fileWithLink);
		}
	}
	const directParent = isIndexFile(file)
		? file.parent!.parent!
		: file.parent!;
	parentIndexes.push(
		...directParent.children
			.filter(isIndexFile)
			.filter((v): v is TFile => v instanceof TFile),
	);

	return parentIndexes;
}
export const getFileIsTargetFileTagFilter = (
	targetFile: TFile | TFolder,
	app: App,
): ((file: TFile) => boolean) => {
	const movable = movableFile(targetFile);
	const trueParent = movable.parent;
	const indexFile =
		movable instanceof TFolder
			? (movable.children.find(isIndexFile) ?? movable)
			: movable;
	return (file) => {
		const isDirectParent = isIndexFile(file) && file.parent === trueParent;
		if (isDirectParent) return true;
		console.log();
		const links = app.metadataCache.getCache(file.path)?.frontmatterLinks;
		return !!links?.some(
			(l) =>
				l.key.startsWith("symlinks.") &&
				app.metadataCache.getFirstLinkpathDest(l.link, file.path) ===
					indexFile,
		);
	};
};
export function getFileChildrenIndexes(file: TFile, app: App): TFile[] {
	const children: TFile[] = [];
	for (const link of app.metadataCache.getFileCache(file)?.frontmatterLinks ??
		[]) {
		if (!/^symlinks\.\d+$/.exec(link.key)) continue;
		const child = app.metadataCache.getFirstLinkpathDest(
			link.link,
			file.path,
		);
		if (child) children.push(child);
	}
	const folder =
		file.basename === file.parent?.name ? file.parent : undefined;
	if (folder)
		for (const child of folder.children) {
			if (child === file) continue;
			if (child instanceof TFile) children.push(child);
			if (child instanceof TFolder) {
				const index = child.children.find(
					(v): v is TFile =>
						v instanceof TFile && v.basename === child.name,
				);
				if (index) children.push(index);
			}
		}

	return uniq(children);
}
function findUnoccupiedRenamePath(
	source: TAbstractFile,
	newpath: string,
	app: App,
) {
	const base = newpath + "/" + source.name;
	if (!app.vault.getFileByPath(base)) return base;
	let i = 1;
	while (i < 100) {
		const candidate =
			source instanceof TFile
				? `${newpath}/${source.basename}-${i}.${source.extension}`
				: `${newpath}/${source.name}-${i}`;
		if (!app.vault.getFileByPath(candidate)) return candidate;
		i++;
	}
	throw new Error("Failed to find new name for file!");
}
export async function removeFtag(ftag: TFile, source: TFile, app: App) {
	const movable = movableFile(source);
	if (ftag.parent === movable.parent && isIndexFile(ftag)) {
		let otherParent = [
			...app.metadataCache.getBacklinksForFile(source).data,
		]
			.map(([p, refs]) => ({
				p,
				refs,
				file: app.vault.getAbstractFileByPath(p)!,
			}))
			.find(
				(v) =>
					v.refs.some(
						(l) =>
							isFrontmatterLinkCache(l) &&
							/^symlinks\.\d+$/.exec(l.key),
					) &&
					(!isIndexFile(v.file) || v.file.parent !== movable.parent),
			)?.file;
		if (!otherParent)
			otherParent =
				app.vault.getFolderByPath("Uncategorized") ?? undefined;
		if (!otherParent) return;
		const dir = await forceFolder(otherParent, app);
		await app.fileManager.renameFile(
			movable,
			findUnoccupiedRenamePath(movable, dir.folder.path, app),
		);
		// TODO: remove unsoundness
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (dir.index) await removeSymlinksToFile(source, dir.index, app);
		return;
	}
	await removeSymlinksToFile(source, ftag, app);
}

async function removeSymlinksToFile(target: TFile, source: TFile, app: App) {
	const links =
		app.metadataCache
			.getCache(source.path)
			?.frontmatterLinks?.filter(
				(v) =>
					/^symlinks\.\d+$/.exec(v.key) &&
					app.metadataCache.getFirstLinkpathDest(
						v.link,
						source.path,
					) === target,
			)
			.map((v) => v.original) ?? [];
	await app.fileManager.processFrontMatter(source, (f: object) => {
		if (
			"symlinks" in f &&
			Array.isArray(f.symlinks) &&
			f.symlinks.every((v) => typeof v === "string")
		) {
			f.symlinks = f.symlinks.filter((v: string) => {
				return !links.includes(v);
			});
		}
	});
}
