import {Folder} from './../common/Folder';
import {IUploadConfig} from './../common/IUploadConfig';

export class UploadFormController {
  /**
   * Upload configuration. Passed in as component binding.
   */
  public config: IUploadConfig;

  /**
   * Folder to upload files to. Passed in as a component binding.
   */
  public folder: Folder;

  /**
   * Currently selected file.
   */
  public file: any;

  /**
   * Upload key. XXX This is S3 specific, can we make it generic?
   */
  public key: string;

  /**
   * Create an instance of the upload form.
   */
  constructor() {
    this.file = null;
    this.key = '';
  }

  /**
   * Called when the user selects a file.
   */
  public onSelectFile() {
    // update the file key
    this.key = this.folder
      .getPath()
      .clone()
      .push(this.file.name)
      .toString();
  }
}
