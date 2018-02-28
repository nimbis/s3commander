import {Folder} from './../common/Folder';

export class FolderController {
  /**
   * Folder object. Passed in as component binding.
   */
  public folder: Folder;

  /**
   * Navigate to a folder. This is overriden by the component binding.
   */
  public onNavigate() {
    // overriden by binding
  }

  /**
   * Delete a folder. This is overriden by the component binding.
   */
  public onDelete() {
    // overriden by binding
  }
}
