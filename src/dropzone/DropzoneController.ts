import {Folder} from './../common/Folder';
import {IUploadConfig} from './../common/IUploadConfig';
import {IBackend} from './../common/IBackend';

export class DropzoneController {
  /**
   * Upload configuration. Passed in as component binding.
   */
  public config: IUploadConfig;

  /**
   * Folder to upload files to. Passed in as a component binding.
   */
  public folder: Folder;

  /**
   * Backend.
   */
  public backend: IBackend;

  /**
   * Toggle working status.
   */
  public toggleWorking;

  /**
   * Function to refresh bucket contents. This should be binded
   * to the 'loadContents' function in the parent scope.
   */
  public onRefresh;
}
