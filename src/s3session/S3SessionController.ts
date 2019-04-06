export class S3SessionController {
  /**
   * Flag that indicates if a session is in progress.
   */
  public connected: boolean;

  /**
   * AWS Region.
   */
  public region: string;

  /**
   * S3 Bucket.
   */
  public bucket: string;

  /**
   * AWS Access Key Id.
   */
  public accessKeyId: string;

  /**
   * AWS Secret Access Key.
   */
  public secretAccessKey: string;

  /**
   * Allows downloading files.
   */
  public allowDownload: boolean;

  /**
   * Called when the component initializes.
   */
  $onInit() {
    // TODO: load region, bucket, and access key id from local storage
    if (this.allowDownload === undefined) {
      this.allowDownload = true;
    }
  }

  /**
   * Connect to a bucket.
   */
  public connect() {
    // TODO: validate settings?
    // TODO: store region, bucket, and access key id in local storage
    this.connected = true;
  }

  /**
   * Disconnect from a bucket.
   */
  public disconnect() {
    this.connected = false;
  }
}
