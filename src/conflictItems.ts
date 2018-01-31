import { QuickPickItem } from "vscode";

interface ConflictOption {
  label: string;
  description: string;
}

const ConflictOptions = [
  {
    label: "base",
    description:
      "Choose the file that was the (unmodified) BASE revision before you tried to integrate changes"
  },
  {
    label: "working",
    description:
      "Assuming that you've manually handled the conflict resolution, choose the version of the file as it currently stands in your working copy."
  },
  {
    label: "mine-full",
    description:
      "Preserve all local modifications and discarding all changes fetched"
  },
  {
    label: "theirs-full",
    description:
      "Discard all local modifications and integrating all changes fetched"
  },
  {
    label: "mine-conflict",
    description:
      "Resolve conflicted files by preferring local modifications over the changes fetched"
  },
  {
    label: "theirs-conflict",
    description:
      "Resolve conflicted files by preferring the changes fetched from the server over local modifications"
  }
];

class ConflictItem implements QuickPickItem {
  constructor(private option: ConflictOption) {}

  get label(): string {
    return this.option.label;
  }

  get description(): string {
    return this.option.description;
  }
}

export function getConflictPickOptions() {
  return ConflictOptions.map(option => new ConflictItem(option));
}
