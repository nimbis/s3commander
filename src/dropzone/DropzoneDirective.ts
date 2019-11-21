import * as angular from 'angular';

import {DropzoneController} from './DropzoneController';

import crypto = require('crypto-js');
import Dropzone = require('dropzone');

/**
 * Define new interface to allow accessing '$ctrl' from scope
 * https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18196
 */
interface IDropzoneDirectiveScope extends ng.IScope {
  $ctrl: DropzoneController;
}

/**
 * The DropzoneDirective class has access to the parent
 * controller scope.
 */
export class DropzoneDirective implements ng.IDirective {
  /**
   * Match class name.
   */
  public restrict: string = 'C';

  /**
   * Update the DOM to implement the directive.
   */
  public link(
    scope: IDropzoneDirectiveScope,
    element: ng.IAugmentedJQuery,
    attrs: ng.IAttributes
  ) {
    // dropzone configuration
    let dropzoneConfig = {
      url: scope.$ctrl.config.url,
      maxFilesize: 102400,
      addRemoveLinks: true,
      dictCancelUpload: 'Cancel',
      dictDefaultMessage: 'Click here or Drop files here to upload',
      timeout: 0,
      filesizeBase: 1024,
      canceled: canceledCallback
    };

    // override dropzone cancel to call the backend cancelUpload
    function canceledCallback(file: any) {
      // check if file was canceled prior to completing upload since
      // this callback is also triggered when removeFile() is called
      // after successfully uploading files.
      if (file.uploadCompleted === false) {
        scope.$ctrl.backend.cancelUpload({
          file: file
        }).then((data: any) => {
          console.log('Filed upload canceled: ' + file.name);
        });
      }
    }

    // in order to allow access to 'scope' inside the dropzone
    // handler functions, the functions need to be wrapped in
    // scope.$apply.
    let eventHandlers = {
      'uploadprogress': function(file: any) {
        // notify the bucket that we're working
        scope.$ctrl.toggleWorking({state: true});
      },
      'success': function(file: any) {
        scope.$ctrl.onRefresh({});
        this.removeFile(file);
      },
      'complete': function(file: any) {
        // check if we finished adding and uploading all
        // files and the queue is empty. If we did,
        // emit the queuecomplete event.
        if (this.getAddedFiles().length === 0 &&
            this.getUploadingFiles().length === 0 &&
            this.getQueuedFiles().length === 0) {
          this.emit('queuecomplete');
        }
      },
      'error': function(file: any, errorMessage: string, xhr?: any) {
        console.log('An error has occurred: ' + errorMessage);

        if (xhr) {
          console.log(xhr);
        }
      },
      'reset': function() {
        // notify the bucket that we're done working
        scope.$ctrl.toggleWorking({state: false});
      },
      'queuecomplete': function() {
        // notify the bucket that we're done working
        scope.$ctrl.toggleWorking({state: false});
        // refresh folder contents
        scope.$ctrl.onRefresh({});

        // disable prompt when user attempts to navigate away from this page
        window.onbeforeunload = null;
      }
    };

    let dropzone = new Dropzone(element[0], dropzoneConfig);
    angular.forEach(eventHandlers, (handler, event) => {
      dropzone.on(event, handler);
    });

    // override dropzone uploadFiles function to use the backend
    // multi-part upload instead.
    Dropzone.prototype.uploadFiles = function(files: any) {
      // enable prompt when user attempts to navigate away from this page
      // while uploading a file
      window.onbeforeunload = function() {
        return true;
      };

      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let SHA1 = crypto.algo.SHA1.create();
        let lastOffset = 0;
        let self = this;

        let t0 = performance.now();
        let t1 = null;

        // upload file using backend
        let uploadFile = function(self: any, file: any) {
          let key = scope.$ctrl.backend.getFilePath(scope.$ctrl.folder, file);
          scope.$ctrl.backend.uploadFile({
            Bucket: scope.$ctrl.config.fields.bucket,
            Key: key,
            Body: file,
            Dropzone: self
          }).then((res: any) => {
            if (res.err) {
              file.status = Dropzone.ERROR;
              dropzone.emit('error', file, res.err.message);
              dropzone.emit('complete', file);
            } else {
              file.uploadCompleted = true;
              file.status = Dropzone.SUCCESS;
              dropzone.emit('success', file);
              dropzone.emit('complete', file);
            }
            if (self.options.autoProcessQueue) {
              dropzone.processQueue();
            }
          });
        }

        // update the rolling SHA1 hash
        let update = function(data: any) {
          let wordBuffer = crypto.lib.WordArray.create(data);
          SHA1.update(wordBuffer);
        }

        // compute final SHA1 hash after reading all chunks
        let finalize = function(data: any) {
          let hash = SHA1.finalize().toString();
          t1 = performance.now();

          console.log('FILE: ' + file.name);
          console.log('HASH: ' + hash);
          console.log('Time to compute hash: ' + (t1-t0) + ' milliseconds.');

          file.sha1 = hash
          uploadFile(self, file);
        }

        // after reading a chunk, determine if last chunk was received
        let readCallback = function(reader: any, props: any, file: any, event: any, update: any, finalize: any) {
          update(event.target.result);
          if (props.offset + props.size >= file.size ){
            finalize();
          }
        }

        // read the entire file and calculate SHA1 hash before uploading
        let load = function(file: any, update: any, finalize: any) {
          let chunkSize = 1024 * 1024 * 10;
          let offset = 0;
          let size = chunkSize;
          let index = 0;
          let partial = null;

          if (file.size === 0) {
            finalize();
          }

          while (offset < file.size) {
            partial = file.slice(offset, offset + size);
            let reader = new FileReader();
            let props = {
              size: chunkSize,
              offset: offset,
              index: index
            };

            reader.onload = function(event: any) {
              readCallback(this, props, file, event, update, finalize);
            }
            reader.readAsArrayBuffer(partial);
            offset += chunkSize;
            index += 1;
          }
        }

        load(file, update, finalize);
      }
    };
  }
}
