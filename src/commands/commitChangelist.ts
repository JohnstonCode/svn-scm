import { SourceControlResourceGroup, window } from "vscode";
import { Command } from "./command";
import { inputCommitMessage } from "../messages";

export class CommitChangelist extends Command {
  constructor() {
    super("svn.commitChangelist");
  }

  public async execute(resourceGroup: SourceControlResourceGroup) {
	  const changelistName = resourceGroup.id.replace(/^changelist-/, '');
	  const resourceUri = [resourceGroup.resourceStates[0].resourceUri];
	  
	  await this.runByRepository(resourceUri, async (repository, _resources) => {
		if (!repository) {
			return;
		  }
		  
		  try {
			const message = await inputCommitMessage(repository.inputBox.value);
	
			if (message === undefined) {
			  return;
			}
	
			repository.inputBox.value = message;
	
			const result = await repository.commitChangelist(message, changelistName);
			window.showInformationMessage(result);
			repository.inputBox.value = "";
		  } catch (error) {
			console.error(error);
			window.showErrorMessage(error.stderrFormated);
		  }
	  });
	  
    console.log(resourceGroup);
  }
}
