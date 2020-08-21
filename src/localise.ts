import * as fs from "fs";
import * as path from "path";

interface IConfig {
  locale?: string;
}

interface ILanguagePack {
  [key: string]: string;
}

declare const __non_webpack_require__: typeof require;

class Localize {
  private bundle: ILanguagePack = {};
  private extensionPath: string = "";
  constructor(private options: IConfig = {}) {}
  /**
   * translate the key
   * @param key
   * @param args
   */
  public localize(key: string, ...args: string[]): string {
    const languagePack = this.bundle;
    const message: string = languagePack[key] || key;
    return this.format(message, args);
  }
  public init(extensionPath: string) {
    this.extensionPath = extensionPath;
    this.bundle = this.resolveLanguagePack();
  }
  private format(message: string, args: string[] = []): string {
    let result: string;
    if (args.length === 0) {
      result = message;
    } else {
      result = message.replace(/\{(\d+)\}/g, (match, rest: any[]) => {
        const index = rest[0];
        return typeof args[index] !== "undefined" ? args[index] : match;
      });
    }
    return result;
  }
  private resolveLanguagePack(): ILanguagePack {
    const defaultResvoleLanguage = ".nls.json";
    let resolvedLanguage: string = "";
    const rootPath = this.extensionPath || process.cwd();
    const file = path.join(rootPath, "package");
    const options = this.options;

    if (!options.locale) {
      resolvedLanguage = defaultResvoleLanguage;
    } else {
      let locale: string | null = options.locale;
      while (locale) {
        const candidate = ".nls." + locale + ".json";
        if (fs.existsSync(file + candidate)) {
          resolvedLanguage = candidate;
          break;
        } else {
          const index = locale.lastIndexOf("-");
          if (index > 0) {
            locale = locale.substring(0, index);
          } else {
            resolvedLanguage = ".nls.json";
            locale = null;
          }
        }
      }
    }

    let defaultLanguageBundle = {};

    // if not use default language
    // then merger the Language pack
    // just in case the resolveLanguage bundle missing the translation and fallback with default language
    if (resolvedLanguage !== defaultResvoleLanguage) {
      defaultLanguageBundle = __non_webpack_require__(
        path.join(file + defaultResvoleLanguage)
      );
    }

    const languageFilePath = path.join(file + resolvedLanguage);

    const isExistResolvedLanguage = fs.existsSync(languageFilePath);

    const ResolvedLanguageBundle = isExistResolvedLanguage
      ? __non_webpack_require__(languageFilePath)
      : {};

    // merger with default language bundle
    return { ...defaultLanguageBundle, ...ResolvedLanguageBundle };
  }
}

let config: IConfig = {
  locale: "en"
};

try {
  config = Object.assign(
    config,
    JSON.parse((process.env as any).VSCODE_NLS_CONFIG)
  );
} catch (err) {
  //
}

const instance = new Localize(config);

export function init(extensionPath: string): void {
  return instance.init(extensionPath);
}

export function localize(key: string, ...args: string[]): string {
  return instance.localize(key, ...args);
}
