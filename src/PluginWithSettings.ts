import { around } from "monkey-around";
import { PluginSettingTab, Plugin, App } from "obsidian";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any[]) => any;
export default function PluginWithSettings<S extends object>(
	DEFAULT_SETTINGS: S,
) {
	type Uninstallers = (() => void)[];
	type MethodWrapperFactory<O, T extends Fn, P> = (
		next: T,
		plugin: P,
	) => (this: O, ...args: Parameters<T>) => ReturnType<T>;

	return class PluginWithSettings extends Plugin {
		settings: S = DEFAULT_SETTINGS;

		private async loadSettings() {
			Object.assign(this.settings, await this.loadData());
		}

		async initSettings(
			SettingsTab: new (app: App, plugin: this) => PluginSettingTab,
		) {
			await this.loadSettings();
			this.addSettingTab(new SettingsTab(this.app, this));
		}

		async saveSettings() {
			await this.saveData(this.settings);
		}
		private uninstallers: Uninstallers = [];
		protected registerPatch<O extends object>(
			this: PluginWithSettings, // this (pun intended) may be unsound! Why TS does not check this?
			obj: O,
			factories: Partial<{
				[K in keyof O]: O[K] extends Fn
					? MethodWrapperFactory<O, O[K], this>
					: never;
			}>,
		) {
			const uninstaller = around(
				obj,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				Object.fromEntries(
					Object.entries(
						factories as Record<
							string,
							<T extends (...args: unknown[]) => unknown>(
								next: T,
								t: this,
							) => ReturnType<T>
						>,
					).map(([key, f]) => {
						return [
							key,
							<T extends (...args: unknown[]) => unknown>(
								next: T,
							) => f(next, this as this),
						];
					}),
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				) as any,
			);
			this.uninstallers.push(uninstaller);
			return uninstaller;
		}
		protected uninstallPatches() {
			this.uninstallers.forEach((v) => {
				v();
			});
		}
		override unload(): void {
			this.uninstallPatches();
		}
	};
}
