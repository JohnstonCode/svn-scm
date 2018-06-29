import { IOperations, Operation } from "./common/types";
import { isReadOnly } from "./util";

export default class OperationsImpl implements IOperations {
  private operations = new Map<Operation, number>();

  public start(operation: Operation): void {
    this.operations.set(operation, (this.operations.get(operation) || 0) + 1);
  }

  public end(operation: Operation): void {
    const count = (this.operations.get(operation) || 0) - 1;

    if (count <= 0) {
      this.operations.delete(operation);
    } else {
      this.operations.set(operation, count);
    }
  }

  public isRunning(operation: Operation): boolean {
    return this.operations.has(operation);
  }

  public isIdle(): boolean {
    const operations = this.operations.keys();

    for (const operation of operations) {
      if (!isReadOnly(operation)) {
        return false;
      }
    }

    return true;
  }
}
