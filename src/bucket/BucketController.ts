import {Bucket} from './../common/Bucket';
import {IBackend} from './../common/IBackend';
import {AmazonS3Backend} from './../common/AmazonS3Backend';

import {IBucketScope} from './IBucketScope';

export class BucketController {
  /**
   * Dependencies we want passed to the constructor.
   * @see http://docs.angularjs.org/guide/di
   */
  public static $inject = [
    '$scope'
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
   * Bucket region. Passed in as a component binding.
   */
  public bucketRegion: string;

  /**
   * Backend.
   */
  private backend: IBackend;

  /**
   * Bucket.
   */
  private bucket: Bucket;

  /**
   * Create a controller instance.
   */
  constructor(private $scope: IBucketScope) { }

  /**
   * Initialize the controller.
   */
  $onInit() {
    switch (this.backendName) {
      case 's3':
        this.backend = new AmazonS3Backend(this.bucketRegion);
        break;

      default:
        throw ('Unknown backend: ' + this.backendName);
    }

    this.bucket = this.$scope.bucket = this.backend.getBucket(this.bucketName);
  }
}
