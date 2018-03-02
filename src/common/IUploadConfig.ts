/**
 * An object that contains settings necessary for uploading files using a
 * POST request.
 */
export interface IUploadConfig {
  /**
   * Upload URL to send POST request to.
   */
  url: string;

  /**
   * Fields to include in the POST request for it to succeed.
   */
  fields: { [key:string]: string };
}
