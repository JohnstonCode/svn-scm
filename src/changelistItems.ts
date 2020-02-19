import { QuickPickItem, window } from "vscode";
import { configuration } from "./helpers/configuration";
import ChangeListItem from "./quickPickItems/changeListItem";
import IgnoredChangeListItem from "./quickPickItems/ignoredChangeListItem";
import NewChangeListItem from "./quickPickItems/newChangeListItem";
import RemoveChangeListItem from "./quickPickItems/removeChangeListItem";
import { Repository } from "./repository";
import { FileItem } from "./quickPickItems/fileItem";

export function getChangelistPickOptions(
  repository: Repository,
  canRemove = false
): QuickPickItem[] {
  const picks: QuickPickItem[] = [];

  picks.push(new NewChangeListItem());
  repository.changelists.forEach((group, _changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });

  const ignoreOnCommitList = configuration.get<string[]>(
    "sourceControl.ignoreOnCommit"
  );
  for (const ignoreOnCommit of ignoreOnCommitList) {
    if (!picks.some(p => p.label === ignoreOnCommit)) {
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

export async function inputCommitFiles(repository: Repository) {
  const choice = await inputCommitChangelist(repository);
  if (!choice) {
    return;
  }

  if (
    choice.id === "changes" &&
    choice.resourceGroup.resourceStates.length > 1
  ) {

    const selectedAll = configuration.get("commit.changes.selectedAll", true);

    const picks = choice.resourceGroup.resourceStates.map(
      r => new FileItem(repository, r, selectedAll)
    );
    const selected = await window.showQuickPick(picks, {
      placeHolder: "Select files to commit",
      canPickMany: true
    });

    if (selected) {
      return selected.map(s => s.state);
    }

    return;
  }

  return choice.resourceGroup.resourceStates;
}

export function patchChangelistOptions(repository: Repository) {
  const picks: QuickPickItem[] = [];

  repository.changelists.forEach((group, _changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });

  return picks;
}

export async function getPatchChangelist(repository: Repository) {
  const picks: QuickPickItem[] = patchChangelistOptions(repository);

  if (!picks.length) {
    window.showErrorMessage("No changelists to pick from");
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
