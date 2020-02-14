import { TimelineProvider, Event, Uri, CancellationToken, TimelineItem, ThemeIcon } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { ISvnLogEntry } from "../common/types";
import { formatDistanceToNow, format } from "date-fns";

export class SvnTimelineProvider implements TimelineProvider {
    onDidChange?: Event<Uri | undefined> | undefined;
    source: string;
    sourceDescription: string;
    replaceable?: boolean | undefined;

    constructor(private sourceControlManager: SourceControlManager) {
        this.source = 'svn';
        this.sourceDescription = 'svn';
        this.replaceable = true;
    }

    async provideTimeline(uri: Uri, _token: CancellationToken): Promise<TimelineItem[]> {
        const repo = await this.sourceControlManager.getRepositoryFromUri(uri);
        if (!repo) {
            console.log('faield to find repo');
            return [];
        }

        const commits = await repo.logFile(uri);

        const items = commits.map((commit: ISvnLogEntry) => {
            const relativeDate = formatDistanceToNow(Date.parse(commit.date), {
                addSuffix: true
              });
            const formattedDate = format(Date.parse(commit.date), 'LLLL do, yyyy kk:mm')

            return {
                timestamp: Date.parse(commit.date),
                label: commit.msg,
                description: `${relativeDate}  \u2022  ${commit.author}`,
                detail: `Author: ${commit.author}\n${formattedDate}\nRevision: ${commit.revision}\nMessage: ${commit.msg}`,
                iconPath: new ThemeIcon('git-commit')
            }
        });

        return items;
    }
}