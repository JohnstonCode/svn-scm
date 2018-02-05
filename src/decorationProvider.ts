/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import {
  window,
  workspace,
  Uri,
  Disposable,
  Event,
  EventEmitter,
  DecorationData,
  DecorationProvider,
  ThemeColor
} from "vscode";
import { Repository } from "./repository";
import { Model } from "./model";
import { debounce } from "./decorators";
import { filterEvent, isDescendant } from "./util";
import { SvnResourceGroup } from "./resource";
import { Status } from "./svn";
import * as path from "path";

class SvnIgnoreDecorationProvider implements DecorationProvider {
  private readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
  readonly onDidChangeDecorations: Event<Uri[]> = this._onDidChangeDecorations
    .event;

  private checkIgnoreQueue = new Map<
    string,
    { resolve: (status: boolean) => void; reject: (err: any) => void }
  >();
  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    this.disposables.push(
      window.registerDecorationProvider(this),
      repository.onDidChangeStatus(_ => this._onDidChangeDecorations.fire())
    );
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.checkIgnoreQueue.clear();
  }

  provideDecoration(uri: Uri): Promise<DecorationData | undefined> {
    return new Promise<boolean>((resolve, reject) => {
      this.checkIgnoreQueue.set(uri.fsPath, { resolve, reject });
      this.checkIgnoreSoon();
    }).then(ignored => {
      if (ignored) {
        return <DecorationData>{
          priority: 3,
          color: new ThemeColor("gitDecoration.ignoredResourceForeground")
        };
      }
    });
  }

  @debounce(500)
  private checkIgnoreSoon(): void {
    const queue = new Map(this.checkIgnoreQueue.entries());
    this.checkIgnoreQueue.clear();

    const ignored = this.repository.statusIgnored;
    const external = this.repository.statusExternal;

    const files = ignored.map(stat =>
      path.join(this.repository.workspaceRoot, stat.path)
    );

    files.push(
      ...external.map(stat =>
        path.join(this.repository.workspaceRoot, stat.path)
      )
    );

    for (const [key, value] of queue.entries()) {
      value.resolve(files.some(file => isDescendant(file, key)));
    }
  }
}

class SvnDecorationProvider implements DecorationProvider {
  private readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
  readonly onDidChangeDecorations: Event<Uri[]> = this._onDidChangeDecorations
    .event;

  private disposables: Disposable[] = [];
  private decorations = new Map<string, DecorationData>();

  constructor(private repository: Repository) {
    this.disposables.push(
      window.registerDecorationProvider(this),
      repository.onDidRunOperation(this.onDidRunOperation, this)
    );
  }

  private onDidRunOperation(): void {
    let newDecorations = new Map<string, DecorationData>();
    this.collectDecorationData(this.repository.changes, newDecorations);
    this.collectDecorationData(this.repository.unversioned, newDecorations);
    this.collectDecorationData(this.repository.conflicts, newDecorations);

    this.repository.changelists.forEach((group, changelist) => {
      this.collectDecorationData(group, newDecorations);
    });

    let uris: Uri[] = [];
    newDecorations.forEach((value, uriString) => {
      if (this.decorations.has(uriString)) {
        this.decorations.delete(uriString);
      } else {
        uris.push(Uri.parse(uriString));
      }
    });
    this.decorations.forEach((value, uriString) => {
      uris.push(Uri.parse(uriString));
    });
    this.decorations = newDecorations;
    this._onDidChangeDecorations.fire(uris);
  }

  private collectDecorationData(
    group: SvnResourceGroup,
    bucket: Map<string, DecorationData>
  ): void {
    group.resourceStates.forEach(r => {
      if (r.resourceDecoration) {
        bucket.set(r.resourceUri.toString(), r.resourceDecoration);
      }
    });
  }

  provideDecoration(uri: Uri): DecorationData | undefined {
    return this.decorations.get(uri.toString());
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

export class SvnDecorations {
  private configListener: Disposable;
  private modelListener: Disposable[] = [];
  private providers = new Map<Repository, Disposable>();

  constructor(private model: Model) {
    // this.configListener = workspace.onDidChangeConfiguration(
    //   e => e.affectsConfiguration("svn.decorations.enabled") && this.update()
    // );
    this.update();
  }

  private update(): void {
    const enabled = workspace
      .getConfiguration()
      .get<boolean>("svn.decorations.enabled");
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  private enable(): void {
    this.modelListener = [];
    this.model.onDidOpenRepository(
      this.onDidOpenRepository,
      this,
      this.modelListener
    );
    // this.model.onDidCloseRepository(
    //   this.onDidCloseRepository,
    //   this,
    //   this.modelListener
    // );
    this.model.repositories.forEach(this.onDidOpenRepository, this);
  }

  private disable(): void {
    this.modelListener.forEach(d => d.dispose());
    this.providers.forEach(value => value.dispose());
    this.providers.clear();
  }

  private onDidOpenRepository(repository: Repository): void {
    const provider = new SvnDecorationProvider(repository);
    const ignoreProvider = new SvnIgnoreDecorationProvider(repository);
    this.providers.set(repository, Disposable.from(provider, ignoreProvider));
  }

  private onDidCloseRepository(repository: Repository): void {
    const provider = this.providers.get(repository);
    if (provider) {
      provider.dispose();
      this.providers.delete(repository);
    }
  }

  dispose(): void {
    this.configListener.dispose();
    this.modelListener.forEach(d => d.dispose());
    this.providers.forEach(value => value.dispose);
    this.providers.clear();
  }
}
