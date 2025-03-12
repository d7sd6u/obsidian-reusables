import { AbstractInputSuggest, TFolder, App } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.close();
	}
	protected override getSuggestions(query: string): TFolder[] {
		return this.app.vault
			.getAllFolders(true)
			.filter((f) => f.path.includes(query));
	}
	override renderSuggestion(value: TFolder, el: HTMLElement): void {
		el.innerText = value.path;
	}
	override onSelect(
		callback: (value: TFolder, evt: MouseEvent | KeyboardEvent) => unknown,
	) {
		super.onSelect((value, evt) => {
			callback(value, evt);

			this.close();
			this.inputEl.blur();
		});
		return this;
	}
}
