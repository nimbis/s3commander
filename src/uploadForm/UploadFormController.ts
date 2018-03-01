import {Folder} from './../common/Folder';
import {IUploadConfig} from './../common/IUploadConfig';

export class UploadFormController {
  /**
   * Dependencies we want passed to the constructor.
   * @see http://docs.angularjs.org/guide/di
   */
  public static $inject = [
    '$timeout'
  ];

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
  constructor(private $timeout: ng.ITimeoutService) {
    this.file = null;
    this.key = '';
  }

  /**
   * Called when the user selects a file.
   */
  public onSelectFile(form: any) {
    // update the file key
    this.key = this.folder
      .getPath()
      .clone()
      .push(this.file.name)
      .toString();

    // submit the form after the current $digest() cycle has finished so the
    // key hidden input has been updated to the value set above
    this.$timeout(() => {
      if (form.$valid) {
        form.submit();
      }
    });
  }
}
