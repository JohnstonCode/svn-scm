import {
  QuickPickItem,
  SourceControlResourceGroup,
  window,
  workspace
} from "vscode";
import { Repository } from "./repository";
import { configuration } from "./helpers/configuration";

export class ChangeListItem implements QuickPickItem {
  constructor(protected group: SourceControlResourceGroup) {}

  get label(): string {
    return this.group.id.replace(/^changelist-/, "");
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

export class IgnoredChangeListItem implements QuickPickItem {
  constructor(protected _id: string) {}

  get label(): string {
    return this._id;
  }

  get description(): string {
    return "Ignored on commit";
  }
}

export class RemoveChangeListItem implements QuickPickItem {
  constructor() {}

  get label(): string {
    return "$(dash) Remove changelist";
  }

  get description(): string {
    return "Remove changelist of file(s)";
  }
}

export function getChangelistPickOptions(
  repository: Repository,
  canRemove = false
): QuickPickItem[] {
  const picks: QuickPickItem[] = [];

  picks.push(new NewChangeListItem());
  repository.changelists.forEach((group, changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });

  const ignoreOnCommitList = configuration.get<string[]>(
    "sourceControl.ignoreOnCommit"
  );
  for (const ignoreOnCommit of ignoreOnCommitList) {
    if(!picks.some(p => p.label === ignoreOnCommit)){
      picks.push(new IgnoredChangeListItem(ignoreOnCommit));
    }
  }

  if (canRemove) {
    picks.push(new RemoveChangeListItem());
  }

  return picks;
}

export function getCommitChangelistPickOptions(
  repository: Repository
): ChangeListItem[] {
  const picks: ChangeListItem[] = [];

  if (repository.changes.resourceStates.length) {
    picks.push(new ChangeListItem(repository.changes));
  }

  const ignoreOnCommitList = configuration.get<string[]>(
    "sourceControl.ignoreOnCommit"
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

export async function inputSwitchChangelist(
  repository: Repository,
  canRemove = false
) {
  const picks: QuickPickItem[] = getChangelistPickOptions(
    repository,
    canRemove
  );

  const selectedChoice: any = await window.showQuickPick(picks, {
    placeHolder: "Select an existing changelist or create a new"
  });
  if (!selectedChoice) {
    return;
  }

  let changelistName;

  if (selectedChoice instanceof RemoveChangeListItem) {
    return false;
  } else if (selectedChoice instanceof NewChangeListItem) {
    const newChangelistName = await window.showInputBox({
      placeHolder: "Changelist name",
      prompt: "Please enter a changelist name"
    });
    if (!newChangelistName) {
      return;
    }
    changelistName = newChangelistName;
  } else {
    changelistName = selectedChoice.label;
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

export function patchChangelistOptions(repository: Repository) {
  const picks: QuickPickItem[] = [];

  repository.changelists.forEach((group, changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });

  return picks;
}

export async function getPatchChangelist(repository: Repository) {
  const picks: QuickPickItem[] = patchChangelistOptions(repository);

  if (!picks.length) {
    window.showErrorMessage('No changelists to pick from');
    return;
  }

  const selectedChoice: any = await window.showQuickPick(picks, {
    placeHolder: "Select a changelist"
  });
  if (!selectedChoice) {
    return;
  }

  return selectedChoice.label;
}
