import {Path} from './../common/Path';
import {StorageBucket} from './../common/StorageBucket';
import {StorageObject} from './../common/StorageObject';
import {IBackend} from './../common/IBackend';
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
  public bucket: StorageBucket;

  /**
   * Current working path.
   */
  public workingPath: Path;

  /**
   * Folder objects in the current working path.
   */
  public folders: StorageObject[];

  /**
   * File objects in the current working path.
   */
  public files: StorageObject[];

  /**
   * Backend.
   */
  private backend: IBackend;

  /**
   * Create an instance of the controller.
   */
  constructor(private $rootScope: ng.IScope) {
    this.workingPath = new Path('/');
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

    // retrieve the bucket and objects at the working path
    this.working = true;
    this.backend.getBucket(this.bucketName).then((bucket: StorageBucket) => {
      this.bucket = bucket;
      return this.backend.getObjects(bucket, this.workingPath);
    }).then((objects: StorageObject[]) => {
      function compareObjectNames (a: StorageObject, b: StorageObject) {
        var nameA = a.path.name().toLowerCase();
        var nameB = b.path.name().toLowerCase();

        if (nameA < nameB) {
          return -1;
        }

        if (nameA > nameB) {
          return 1;
        }

        return 0;
      }

      // retrieve folders and sort alphabetically by name
      this.folders = objects.filter((object: StorageObject) => {
        return object.path.isFolder();
      }).sort(compareObjectNames);

      // retrieve files and sort alphabetically by name
      this.files = objects.filter((object: StorageObject) => {
        return !object.path.isFolder();
      }).sort(compareObjectNames);
    }).catch((error: Error) => {
      this.error = error;

      // XXX: well this is extreme
      this.bucket = null;
      this.folders = [];
      this.files = [];
    }).then(() => {
      this.working = false;

      // apply scope changes. because we're using $ctrl instead of $scope in
      // the template we need to update the parent scope somehow.
      this.$rootScope.$digest();
    });
  }
}
