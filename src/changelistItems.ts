import {
  QuickPickItem,
  SourceControlResourceGroup,
  window,
  workspace
} from "vscode";
import { Repository } from "./repository";

export class ChangeListItem implements QuickPickItem {
  constructor(protected group: SourceControlResourceGroup) {}

  get label(): string {
    return this.group.label;
  }

  get description(): string {
    return this.group.label;
  }
  get resourceGroup(): SourceControlResourceGroup {
    return this.group;
  }
}

export class NewChangeListItem implements QuickPickItem {
  constructor() {}

  get label(): string {
    return "$(plus) New changelist";
  }

  get description(): string {
    return "Create a new change list";
  }
}

export function getChangelistPickOptions(
  repository: Repository
): QuickPickItem[] {
  const picks: QuickPickItem[] = [];

  repository.changelists.forEach((group, changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });
  picks.push(new NewChangeListItem());

  return picks;
}

export function getCommitChangelistPickOptions(
  repository: Repository
): ChangeListItem[] {
  const picks: ChangeListItem[] = [];

  if (repository.changes.resourceStates.length) {
    picks.push(new ChangeListItem(repository.changes));
  }

  const svnConfig = workspace.getConfiguration("svn");
  const ignoreOnCommitList = svnConfig.get<string[]>(
    "sourceControl.ignoreOnCommit",
    []
  );

  repository.changelists.forEach((group, changelist) => {
    if (
      group.resourceStates.length &&
      !ignoreOnCommitList.includes(changelist)
    ) {
      picks.push(new ChangeListItem(group));
    }
  });
  return picks;
}

export async function inputSwitchChangelist(repository: Repository) {
  const picks: QuickPickItem[] = getChangelistPickOptions(repository);

  const selectedChoice: any = await window.showQuickPick(picks, {
    placeHolder: "Select an existing changelist or create a new"
  });
  if (!selectedChoice) {
    return;
  }

  let changelistName;

  if (selectedChoice instanceof NewChangeListItem) {
    const newChangelistName = await window.showInputBox({
      placeHolder: "Changelist name",
      prompt: "Please enter a changelist name"
    });
    if (!newChangelistName) {
      return;
    }
    changelistName = newChangelistName;
  } else if (selectedChoice instanceof ChangeListItem) {
    changelistName = selectedChoice.resourceGroup.id.replace(
      /^changelist-/,
      ""
    );
  }

  return changelistName;
}

export async function inputCommitChangelist(repository: Repository) {
  const picks: ChangeListItem[] = getCommitChangelistPickOptions(repository);

  if (picks.length === 0) {
    window.showInformationMessage("There are no changes to commit.");
    return;
  }

  let choice;
  // If has only changes, not prompt to select changelist
  if (picks.length === 1 && repository.changes.resourceStates.length) {
    choice = picks[0];
  } else {
    choice = await window.showQuickPick(picks, {
      placeHolder: "Select a changelist to commit"
    });
  }

  return choice;
}
