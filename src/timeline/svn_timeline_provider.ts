import {
  TimelineProvider,
  Disposable,
  Event,
  workspace,
  Uri,
  TimelineOptions,
  CancellationToken,
  Timeline,
  EventEmitter,
  TimelineChangeEvent,
  ThemeIcon
} from "vscode";
import { SourceControlManager } from "../source_control_manager";
import dayjs = require("dayjs");

import advancedFormat = require('dayjs/plugin/advancedFormat');
dayjs.extend(advancedFormat);

export class SvnTimelineProvider implements TimelineProvider {
  private _onDidChange = new EventEmitter<TimelineChangeEvent>();
  get onDidChange(): Event<TimelineChangeEvent> {
    return this._onDidChange.event;
  }

  readonly id = 'svn-history';
  readonly label = 'Svn History';

  private disposable: Disposable;

  constructor(private sourceControlManager: SourceControlManager) {
    this.disposable = Disposable.from(
      workspace.registerTimelineProvider(["file", "svn"], this)
    );
  }

  dispose() {
    this.disposable.dispose();
  }

  async provideTimeline(
    uri: Uri,
    _options: TimelineOptions,
    _token: CancellationToken
  ): Promise<Timeline> {
    const repo = await this.sourceControlManager.getRepositoryFromUri(uri);
    if (!repo) {
      return { items: [] };
    }

    let commits = [];

    try {
        const info = await repo.getInfo(uri.fsPath);
        console.log(info);
        commits = await repo.log(info.revision, "1", 2, Uri.parse(info.url));
        console.log(commits);   
    } catch (error) {
        console.log(error);
        return { items: [] };
    }

    const items = commits.map(commit => {
        const timestamp = Number(dayjs(commit.date).format('x'));

        console.log(timestamp);

        const index = commit.msg.indexOf('\n');
		const label = index !== -1 ? `${commit.msg.substring(0, index)} \u2026` : commit.msg;
        
        return {
            timestamp,
            label,
            iconPath: new (ThemeIcon as any)('git-commit'),
            description: commit.author,
            detail: `Author: ${commit.author}\n${commit.date}\nRevision: ${commit.revision}\nMessage: ${commit.msg}`,
        };
    });

    return { items };
  }
}
