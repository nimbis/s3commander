import {File} from './../common/File';

export class FileController {
  /**
   * File object. Passed in as component binding.
   */
  public file: File;

  /**
   * Delete a file. This is overriden by the component binding.
   */
  public onDelete() {
    // overriden by binding
  }
}
