import { Uri, window } from "vscode";
import { SvnDepth } from "../common/types";
import { lstat } from "../fs";

export async function confirmRevert() {
  const yes = "Yes I'm sure";
  const answer = await window.showWarningMessage(
    "Are you sure? This will wipe all local changes.",
    { modal: true },
    yes
  );

  if (answer !== yes) {
    return false;
  }

  return true;
}

export async function promptDepth() {
  const picks: any[] = [];

  for (const depth in SvnDepth) {
    if (SvnDepth.hasOwnProperty(depth)) {
      picks.push({ label: depth, description: (SvnDepth as any)[depth] });
    }
  }

  const placeHolder = "Select revert depth";
  const pick = await window.showQuickPick(picks, { placeHolder });
  if (!pick) {
    return undefined;
  }
  return pick.label;
}

export async function checkAndPromptDepth(
  uris: Uri[],
  defaultDepth: keyof typeof SvnDepth = "empty"
) {
  // Without uris, force prompt
  let hasDirectory = uris.length === 0;

  for (const uri of uris) {
    if (uri.scheme !== "file") {
      continue;
    }
    try {
      const stat = await lstat(uri.fsPath);
      if (stat.isDirectory()) {
        hasDirectory = true;
        break;
      }
    } catch (error) {
      // ignore
    }
  }

  if (hasDirectory) {
    return promptDepth();
  }

  return defaultDepth;
}
