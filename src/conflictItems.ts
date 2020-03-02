/* tslint:disable:max-line-length */

import { QuickPickItem } from "vscode";
import { IConflictOption } from "./common/types";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

const conflictOptions = [
  {
    label: localize("conflictItems.base", "base"),
    description: localize(
      "conflictItems.base.description",
      "Choose the file that was the (unmodified) BASE revision before you tried to integrate changes"
    )
  },
  {
    label: localize("conflictItems.working", "working"),
    description: localize(
      "conflictItems.working.description",
      "Assuming that you've manually handled the conflict resolution, choose the version of the file as it currently stands in your working copy."
    )
  },
  {
    label: localize("conflictItems.mine_full", "mine-full"),
    description: localize(
      "conflictItems.mine_full.description",
      "Preserve all local modifications and discarding all changes fetched"
    )
  },
  {
    label: localize("conflictItems.theirs_full", "theirs-full"),
    description: localize(
      "conflictItems.theirs_full.description",
      "Discard all local modifications and integrating all changes fetched"
    )
  },
  {
    label: localize("conflictItems.mine_conflict", "mine-conflict"),
    description: localize(
      "conflictItems.mine_conflict.description",
      "Resolve conflicted files by preferring local modifications over the changes fetched"
    )
  },
  {
    label: localize("conflictItems.theirs_conflict", "theirs-conflict"),
    description: localize(
      "conflictItems.theirs_conflict.description",
      "Resolve conflicted files by preferring the changes fetched from the server over local modifications"
    )
  }
];

class ConflictItem implements QuickPickItem {
  constructor(private option: IConflictOption) {}

  get label(): string {
    return this.option.label;
  }

  get description(): string {
    return this.option.description;
  }
}

export function getConflictPickOptions() {
  return conflictOptions.map(option => new ConflictItem(option));
}
