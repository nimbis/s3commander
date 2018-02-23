import {Bucket} from './../common/Bucket';
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
   * TODO.
   */
  public error: Error;

  /**
   * Bucket.
   */
  public bucket: Bucket;

  /**
   * Backend.
   */
  private backend: IBackend;

  /**
   * Create an instance of the controller.
   */
  constructor(private $rootScope: ng.IScope) { }

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

    // retrieve the bucket
    this.working = true;
    this.backend.getBucket(this.bucketName).then(
      (bucket: Bucket) => {
        this.bucket = bucket;
        this.error = null;
      },
      (error: Error) => {
        this.bucket = null;
        this.error = error;
      }
    ).then(() => {
      this.working = false;

      // apply scope changes. because we're using $ctrl instead of $scope in
      // the template we need to update the parent scope somehow.
      this.$rootScope.$digest();
    });
  }
}
