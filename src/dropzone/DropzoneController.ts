import {Folder} from './../common/Folder';
import {IUploadConfig} from './../common/IUploadConfig';

export class DropzoneController {
  /**
   * Upload configuration. Passed in as component binding.
   */
  public config: IUploadConfig;

  /**
   * Folder to upload files to. Passed in as a component binding.
   */
  public folder: Folder;
}
