import * as angular from 'angular';

import {DropzoneController} from './DropzoneController';

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
      accept: acceptCallback,
      canceled: canceledCallback
    };

    // override dropzone accept so the multipart upload is
    // initiated for each file uploaded.
    function acceptCallback(file: any, done: any) {
      let key = scope.$ctrl.backend.getFilePath(scope.$ctrl.folder, file);
      scope.$ctrl.backend.initMultipartUpload({
        Bucket: scope.$ctrl.bucketName,
        Key: key,
        Body: file
      }).then((data: any) => {
        done();
      });
    }

    // override dropzone cancel to call the backend cancelUpload.
    function canceledCallback(file: any) {
      // check if file was canceled prior to completing upload since
      // this callback is also triggered when removeFile() is called
      // after successfully uploading files.
      if (!file.uploadCompleted) {
        scope.$ctrl.backend.cancelUpload({
          file: file
        }).then((data: any) => {
          console.log('File upload canceled: ' + file.name);
        });
      }
    }

    let eventHandlers = {
      'uploadprogress': function(file: any) {
        // notify the bucket that we're working
        scope.$ctrl.toggleWorking({state: true});
      },
      'success': function(file: any) {
        this.removeFile(file);
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

    // override dropone uploadFiles function to use the backend
    // uploading function instead of dropzone. Since all accepted
    // files initiate multipart uploading, the backend uploadPart
    // function is called for each file.
    Dropzone.prototype.uploadFiles = function(files: any) {
      // enable prompt when user attempts to navigate away from this page
      // while uploading a file
      window.onbeforeunload = function() {
        return true;
      };

      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let lastfile = i === files.length - 1;

        scope.$ctrl.backend.uploadPart({
          file: file,
          dropzone: this
        }).then((res: any) => {
          if (res.err) {
            dropzone.emit('error', file, res.err.message);
          } else {
            file.uploadCompleted = true;
            dropzone.emit('success', file);
            if (lastfile) { dropzone.emit('queuecomplete'); }
          }
        });
      }
    };
  }
}
