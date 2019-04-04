/// <reference types="aws-sdk" />

import AWS = require('aws-sdk');
import crypto = require('crypto-js');

import {Bucket} from './Bucket';
import {Path} from './Path';
import {Folder} from './Folder';
import {IFolderContents} from './IFolderContents';
import {IUploadConfig} from './IUploadConfig';
import {File} from './File';
import {IFileVersion} from './IFileVersion';
import {IBackend} from './IBackend';

export class AmazonS3Backend implements IBackend {
  /**
   * Amazon S3 API endpoint.
   */
  private s3: AWS.S3;

  /**
   * Whether to generate a download link.
   */
  private allowDownload: boolean;

  /**
   * Create an instance of the backend.
   * @see https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
   */
  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: string = null,
    allowDownload: boolean = true
  ) {
    this.s3 = new AWS.S3({
      apiVersion: 'latest',
      region: region,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      sessionToken: sessionToken,
      sslEnabled: true,
      signatureVersion: 'v4'
    });

    this.allowDownload = allowDownload;
  }

  /**
   * Get a bucket with the given name.
   */
  public getBucket(name: string): Promise<Bucket> {
    return this.s3.getBucketVersioning({Bucket: name})
      .promise()
      .then((data: any) => {
        return new Bucket(name, data.Status === 'Enabled');
      });
  }

  /**
   * Get the contents of a folder.
   */
  getContents(bucket: Bucket, folder: Folder): Promise<IFolderContents> {
    var params = {
      Bucket: bucket.name,
      Prefix: folder.getPath().toString(),
      Delimiter: '/'
    };

    return this.s3.listObjectsV2(params)
      .promise()
      .then((data: any) => {
        // extract folder objects
        let folders = data.CommonPrefixes.map((folderData: any) => {
          return new Folder(new Path(folderData.Prefix));
        });

        // extract file objects
        let files = data.Contents.filter((fileData: any) => {
          // ignore the folder object by comparing it's path
          return folder.getPath().toString() !== fileData.Key;
        }).map((fileData: any) => {
          let downloadLink = this.allowDownload ? this.s3.getSignedUrl('getObject', {
            Bucket: bucket.name,
            Key: fileData.Key,
            Expires: 900
          }) : undefined;

          return new File(new Path(fileData.Key), downloadLink);
        });

        // return the contents
        return {
          folders: folders,
          files: files
        };
      });
  }

  /**
   * Get the deleted contents of a folder.
   *
   * Returns all folders even if they aren't currently deleted. This is because
   * there isn't a way to determine if a folder is deleted without comparing
   * the output of s3.listObjectVersions() and s3.listObjectsV2() and only
   * selecting the folders that are returned by s3.listObjectVersions, but not
   * by s3.listObjectsV2().
   */
  getDeletedContents(bucket: Bucket, folder: Folder): Promise<IFolderContents> {
    var params = {
      Bucket: bucket.name,
      Prefix: folder.getPath().toString(),
      Delimiter: '/'
    };

    return this.s3.listObjectVersions(params)
      .promise()
      .then((data: any) => {
        // extract folder objects
        let folders = data.CommonPrefixes.map((folderData: any) => {
          return new Folder(new Path(folderData.Prefix), true);
        });

        // extract file objects
        let files = data.DeleteMarkers.filter((fileData: any) => {
          // ignore the folder object by comparing it's path
          // and ignore delete versions that are not the current version.
          // without the IsLatest check, if any past versions of the file have
          // the delete marker, then the file will show up, even if it does not
          // currently have the delete marker.

          return fileData.IsLatest && folder.getPath().toString() !== fileData.Key;
        }).map((fileData: any) => {
          let downloadLink = undefined;

          return new File(new Path(fileData.Key), downloadLink, true);
        });

        // return the contents
        return {
          folders: folders,
          files: files
        };
      });
  }

  /**
   * Create a folder.
   */
  createFolder(bucket: Bucket, folder: Folder): Promise<any> {
    var params = {
      Bucket: bucket.name,
      Key: folder.getPath().toString(),
      Body: ''
    };

    return this.s3.putObject(params).promise();
  }

  /**
   * Delete a folder and its contents.
   */
  deleteFolder(bucket: Bucket, folder: Folder): Promise<any> {
    var getParams = {
      Bucket: bucket.name,
      Prefix: folder.getPath().toString()
    };

    return this.s3.listObjectsV2(getParams)
      .promise()
      .then((data: any) => {
        return data.Contents.map((objectData: any) => {
          return {Key: objectData.Key};
        });
      })
      .then((objects: any[]) => {
        var deleteParams = {
          Bucket: bucket.name,
          Delete: {
            Objects: objects
          }
        };

        return this.s3.deleteObjects(deleteParams).promise();
      });
  }

  /**
   * Get settings necessary to upload files to the given folder.
   */
  public getUploadConfig(bucket: Bucket, folder: Folder): IUploadConfig {
    return {
      url: `https://${bucket.name}.s3.amazonaws.com/`,
      fields: {
        bucket: bucket.name
      }
    };
  }

  /**
   * Get versions of the given file.
   */
  public getFileVersions(bucket: Bucket, file: File): Promise<IFileVersion[]> {
    var params = {
      Bucket: bucket.name,
      Prefix: file.getPath().toString()
    };

    return this.s3.listObjectVersions(params)
      .promise()
      .then((data: any) => {
        // extract file versions
        let versions = data.Versions.map((versionData: any) => {
          let downloadLink = this.allowDownload ? this.s3.getSignedUrl('getObject', {
            Bucket: bucket.name,
            Key: file.getPath().toString(),
            VersionId: versionData.VersionId,
            Expires: 900
          }) : undefined;

          return {
            latest: versionData.IsLatest,
            versionId: versionData.VersionId,
            lastModified: versionData.LastModified,
            deleteMarker: false,
            downloadLink: downloadLink
          };
        });

        // extract deletion markers
        let markers = data.DeleteMarkers.map((markerData: any) => {
          return {
            latest: markerData.IsLatest,
            versionId: markerData.VersionId,
            lastModified: markerData.LastModified,
            deleteMarker: true,
            downloadLink: null
          };
        });

        // return versions and markers
        return versions.concat(markers);
      });
  }

  /**
   * Get full file path given a folder and file.
   */
  public getFilePath(folder: Folder, file: any): string {
    let filePath = file.name;

    if (file.hasOwnProperty('fullPath')) {
      filePath = file.fullPath;
    }

    return folder
        .getPath()
        .clone()
        .push(filePath)
        .toString();
  }

  /**
   * Delete a file.
   */
  deleteFile(bucket: Bucket, file: File): Promise<any> {
    var params = {
      Bucket: bucket.name,
      Key: file.getPath().toString()
    };

    return this.s3.deleteObject(params).promise();
  }

  /**
   * Upload file to S3 using ManagedUpload.
   * Expects the following parameters:
   *
   * params = {
   *   Bucket: name of the bucket
   *   Key: filepath
   *   Body: file object
   *   Dropzone: dropzone object
   * }
   */
  public uploadFile(params: any): Promise<any> {

    let completedParts = [];
    let s3client = this.s3;
    let uploadParams = {
      params: params,
      service: s3client,
      partSize: 1024 * 1024 * 10,
      queueSize: 1
    };

    return new Promise((resolve: any, reject: any) => {
      // callback function to be used with s3.listParts()
      // creates a ManagedUpload from an existing multipart upload.
      let resumeUploadCallback = function(err: any, data: any) {
        if (err) {
          console.log(err);
          resolve({err: err, data: data});
          return;
        }

        // collect data for parts that are already uploaded to aws.
        let byteCount = 0;
        for (let i of Object.keys(data.Parts)) {
          let fr = new FileReader();
          let partNumber = data.Parts[i].PartNumber;

          // compare the MD5 of uploaded part with part from current file
          // add parts with a matching MD5 to the completed parts
          fr.onload = function(event: any) {
            let partMD5 = '"' + crypto.MD5(event.target.result).toString(crypto.enc.Hex) + '"';

            // aws stores the part md5 in the ETag for multipart uploads
            if (partMD5 === data.Parts[i].ETag) {

              // modify current upload object if it exists
              if (params.Body.s3upload) {

                // ignore part if it has been or is being uploaded
                if (params.Body.s3upload.completeInfo[partNumber]) {
                  return;
                }

                // update info for complete parts
                params.Body.s3upload.completeInfo[partNumber] = {
                  ETag: data.Parts[i].ETag,
                  PartNumber: partNumber
                };
                params.Body.s3upload.totalUploadedBytes = params.Body.s3upload.totalUploadedBytes + data.Parts[i].Size;
                params.Body.s3upload.doneParts = params.Body.s3upload.doneParts + 1;
              }
            }
          };

          // get data for part from current file
          let blob = params.Body.slice(byteCount, byteCount + data.Parts[i].Size);
          fr.readAsBinaryString(blob);
          byteCount = byteCount + data.Parts[i].Size;
        }

        let upload = new AWS.S3.ManagedUpload(uploadParams);

        params.Body.s3upload = upload;
        params.Body.s3upload.computeChecksums = true;

        // add event listener to update upload progress
        params.Body.s3upload.on('httpUploadProgress', function(progress: any) {
          if (progress.total) {
            let percent = (progress.loaded * 100) / progress.total;
            params.Dropzone.emit('uploadprogress', params.Body, percent, progress.loaded);
          }
        });

        // start the managed upload
        params.Body.s3upload.send(function(err: any, data: any) {
          resolve({err: err, data: data});
        });
      };

      // callback function to be used with s3.listMultipartUploads
      // looks for an existing multipart upload with the given upload key.
      // uses the existing upload if one exists.  Creates a new upload otherwise.
      let findMultipartUploadCallback = function(err: any, data: any) {
        if (err) {
          console.log(err);
          resolve({err: err, data: data});
          return;
        }

        // check existing uploads for matching upload key.
        for (let upload of data.Uploads) {
          // must copy the UploadId to reuse an existing multipart upload.
          if (upload.Key === params.Key) {
            params.UploadId = upload.UploadId;
            s3client.listParts({
              Bucket: params.Bucket,
              Key: upload.Key,
              UploadId: upload.UploadId
            },
            resumeUploadCallback);
            return;
          }
        }

        // no existing upload with matching key.  Create new upload.
        let upload = new AWS.S3.ManagedUpload(uploadParams);
        params.Body.s3upload = upload;
        params.Body.s3upload.computeChecksums = true;

        // add event listener to update upload progress
        params.Body.s3upload.on('httpUploadProgress', function(progress: any) {
          if (progress.total) {
            let percent = (progress.loaded * 100) / progress.total;
            params.Dropzone.emit('uploadprogress', params.Body, percent, progress.loaded);
          }
        });

        // start the managed upload
        params.Body.s3upload.send(function(err: any, data: any) {
          resolve({err: err, data: data});
        });
      };

      s3client.listMultipartUploads({Bucket: params.Bucket}, findMultipartUploadCallback);
    });
  }

  /**
   * Cancel file upload.
   * Expects the following parameters:
   *
   * params = {
   *   file: file object
   * }
   */
  public cancelUpload(params: any): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
      params.file.s3upload.abort();
      resolve(true);
    });
  }

}
