import { App, Component, View } from "obsidian";
import { ViewRegistryViewByTypeRecord } from "obsidian-typings/src/obsidian/internals/ViewRegistry/ViewRegistryViewByTypeRecord";

export function hookIntoEmbedCreation(
	app: App,
	cb: (ext: string, component: Component) => void,
) {
	function patchEmbedCreator(ext: string) {
		const existing = app.embedRegistry.embedByExtension[ext];
		if (!existing) return;
		app.embedRegistry.embedByExtension[ext] = function (...args) {
			const view = existing.apply(this, args);
			cb(ext, view);
			return view;
		};
	}
	for (const ext of Object.keys(app.embedRegistry.embedByExtension)) {
		patchEmbedCreator(ext);
	}
}

export function hookIntoViewCreation(
	app: App,
	cb: (type: string, view: View) => void,
) {
	for (const type of Object.keys(app.viewRegistry.viewByType)) {
		patchView(app, type, (view) => {
			cb(type, view);
		});
	}
	app.viewRegistry.on("view-registered", (registeredType) => {
		patchView(app, registeredType, (view) => {
			cb(registeredType, view);
		});
	});
}
export function patchView<T extends keyof ViewRegistryViewByTypeRecord>(
	app: App,
	type: T,
	cb: (view: ReturnType<ViewRegistryViewByTypeRecord[T]>) => void,
) {
	const existing = app.viewRegistry.viewByType[type];
	if (!existing) return;
	app.viewRegistry.viewByType[type] = function (...args) {
		const view = existing.apply(this, args);
		cb(view as ReturnType<ViewRegistryViewByTypeRecord[T]>);
		return view;
	};
	iterateAllInstancesOfView(app, type, cb);
}

export function iterateAllInstancesOfView<
	T extends keyof ViewRegistryViewByTypeRecord,
>(
	app: App,
	type: T,
	cb: (view: ReturnType<ViewRegistryViewByTypeRecord[T]>) => void,
) {
	app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view.getViewType() === type) {
			cb(leaf.view as ReturnType<ViewRegistryViewByTypeRecord[T]>);
		}
	});
}
