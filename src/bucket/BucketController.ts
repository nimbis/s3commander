import {Path} from './../common/Path';
import {Bucket} from './../common/Bucket';
import {IBucketObject} from './../common/IBucketObject';
import {File} from './../common/File';
import {Folder} from './../common/Folder';
import {IBackend, IFolderContents} from './../common/IBackend';
import {AmazonS3Backend} from './../common/AmazonS3Backend';

export class BucketController {
  /**
   * Dependencies we want passed to the constructor.
   * @see http://docs.angularjs.org/guide/di
   */
  public static $inject = [
    '$rootScope'
  ];

  /**
   * Backend name. Passed in as component binding.
   */
  public backendName: string;

  /**
   * Bucket name. Passed in as a component binding.
   */
  public bucketName: string;

  /**
   * AWS region. Passed in as a component binding.
   */
  public awsRegion: string;

  /**
   * AWS Access Key ID. Passed in as a component binding.
   */
  public awsAccessKeyId: string;

  /**
   * AWS Secret Access Key. Passed in as a component binding.
   */
  public awsSecretAccessKey: string;

  /**
   * Flag used to indicate a background operation is running.
   */
  public working: boolean;

  /**
   * Error encountered running background operation.
   */
  public error: Error;

  /**
   * Bucket.
   */
  public bucket: Bucket;

  /**
   * Current working folder.
   */
  public currentFolder: Folder;

  /**
   * Folder objects in the current working path.
   */
  public folders: Folder[];

  /**
   * File objects in the current working path.
   */
  public files: File[];

  /**
   * Used to specify the name of new folders.
   */
  public folderName: string;

  /**
   * Backend.
   */
  private backend: IBackend;

  /**
   * Create an instance of the controller.
   */
  constructor(private $rootScope: ng.IScope) {
    this.currentFolder = new Folder(new Path('/'));
    this.folders = [];
    this.files = [];
  }

  /**
   * Initialize the controller.
   */
  $onInit() {
    // create the backend
    if (this.backendName === 's3') {
      this.backend = new AmazonS3Backend(
        this.awsRegion,
        this.awsAccessKeyId,
        this.awsSecretAccessKey);
    } else {
      throw `Unknown backend: ${this.backendName}`;
    }

    // initial load
    this.loadContents();
  }

  /**
   * Load bucket and objects at working path.
   */
  public loadContents(): Promise<any> {
    this.working = true;
    return this.backend.getBucket(this.bucketName)
      .then((bucket: Bucket) => {
        this.bucket = bucket;
        return this.backend.getContents(bucket, this.currentFolder);
      })
      .then((contents: IFolderContents) => {
        function compareObjectNames (a: IBucketObject, b: IBucketObject) {
          var nameA = a.getPath().name().toLowerCase();
          var nameB = b.getPath().name().toLowerCase();

          if (nameA < nameB) {
            return -1;
          }

          if (nameA > nameB) {
            return 1;
          }

          return 0;
        }

        // retrieve folders and files in alphabetical order
        this.folders = contents.folders.sort(compareObjectNames);
        this.files = contents.files.sort(compareObjectNames);
      })
      .catch((error: Error) => {
        // display the error
        this.error = error;
      })
      .then(() => {
        this.working = false;

        // apply scope changes. because we're using $ctrl instead of $scope in
        // the template we need to update the parent scope somehow.
        this.$rootScope.$digest();
      });
  }

  /**
   * Navigate to a folder.
   */
  public navigateFolder(folder: Folder): Promise<any> {
    this.currentFolder = folder;
    return this.loadContents();
  }

  /**
   * Navigate to the parent folder.
   */
  public navigateParent(): Promise<any> {
    this.currentFolder = this.currentFolder.parent();
    return this.loadContents();
  }

  /**
   * Create a folder.
   */
  public createFolder(): Promise<any> {
    let folderPath = this.currentFolder.getPath()
      .clone()
      .push(`${this.folderName}/`);

    this.working = true;
    return this.backend.createFolder(this.bucket, new Folder(folderPath))
      .then(() => {
        this.folderName = '';
        return this.loadContents();
      });
  }

  /**
   * Delete a folder and it's contents.
   */
  public deleteFolder(folder: Folder) {
    this.working = true;
    return this.backend.deleteFolder(this.bucket, folder)
      .then(() => {
        return this.loadContents();
      });
  }

  /**
   * Delete a file.
   */
  public deleteFile(file: File) {
    this.working = true;
    return this.backend.deleteFile(this.bucket, file)
      .then(() => {
        return this.loadContents();
      });
  }
}
