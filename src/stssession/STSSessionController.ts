import {Bucket} from './../common/Bucket';
import {Path} from './../common/Path';
import {IBucketObject} from './../common/IBucketObject';
import {File} from './../common/File';
import {Folder} from './../common/Folder';
import {IFolderContents} from './../common/IFolderContents';
import {IUploadConfig} from './../common/IUploadConfig';
import {IBackend} from './../common/IBackend';
import {AmazonS3Backend} from './../common/AmazonS3Backend';

export class STSSessionController {
  /**
   * Dependencies we want passed to the constructor.
   * @see http://docs.angularjs.org/guide/di
   */
  public static $inject = [
    '$rootScope',
    '$http'
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
   * Allow Download. Flag indicating whether to allow file download.
   */
  public allowDownload: boolean;

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
   * AWS Session Token. Passed in as a component binding.
   */
  public awsSessionToken: string;

  /**
   * AWS bucket prefix for a folder. Passed in as a component binding.
   */
  public awsBucketPrefix: string;

  /**
   * API url to be used to gather sts credentials.
   */
  public stsApiUrl: string;

  /**
   * Header name to be passed in with sts enabled.
   */
  public stsHeaderName: string;

  /**
   * Header value to be passed in with sts enabled.
   */
  public stsHeaderValue: string;

  /**
   * http service.
   */
  public httpService: ng.IHttpService;

  /**
   * Error encountered running background operation.
   */
  public error: Error;

  /**
   * Headers to send to the sts api.
   */
  private httpHeaders: any;

  /**
   * Create an instance of the controller.
   */
  constructor(private $rootScope: ng.IScope, $http: ng.IHttpService) {
    this.httpService = $http;
    this.awsAccessKeyId = '';
    this.awsSecretAccessKey = '';
    this.awsSessionToken = '';

    // default api headers
    this.httpHeaders = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // collect credentials from api every 60 minutes
    setInterval(() => this.credentialsFromAPI(), 1000 * 60 * 60);
  }

  /**
   * Initialize the controller.
   */
  $onInit() {

    // set the currentFolder based on bucket prefix
    if (this.awsBucketPrefix === undefined) {
      this.awsBucketPrefix = '/';
    }

    // default allow download to true
    if (this.allowDownload === undefined) {
      this.allowDownload = true;
    }

    // set extra http headers
    if (!this.stsHeaderName === undefined && !this.stsHeaderValue === undefined) {
      this.httpHeaders.headers[this.stsHeaderName] = this.stsHeaderValue;
    }

    this.credentialsFromAPI();
  }

  /**
   * Calls the sts api, and sets the aws credentials from the result.
   */
  public credentialsFromAPI(): void {
    this.httpService.post(
      this.stsApiUrl,
      {},
      this.httpHeaders)
    .then((response: ng.IHttpResponse<any>): void => {
      this.awsAccessKeyId = response.data.AccessKeyId;
      this.awsSecretAccessKey = response.data.SecretAccessKey;
      this.awsSessionToken = response.data.SessionToken;
    });
  }
}
