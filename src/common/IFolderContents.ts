import {File} from './File';
import {Folder} from './Folder';

/**
 * An object that represents the contents of a folder.
 */
export interface IFolderContents {
  /**
   * Folders.
   */
  folders: Folder[];

  /**
   * Files.
   */
  files: File[];
}
