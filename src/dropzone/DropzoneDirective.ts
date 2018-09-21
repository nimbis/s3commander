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
      chunking: true,
      chunkSize: 1024 * 1024 * 1,
      maxFilesize: 102400,
      addRemoveLinks: true,
      dictCancelUpload: 'Cancel',
      dictDefaultMessage: 'Click here or Drop files here to upload',
      timeout: 0,
      chunksUploaded: function(file: any, done: any) {
        let key = scope.$ctrl.backend.getFilePath(scope.$ctrl.folder, file);
        scope.$ctrl.backend.completeMultipartUpload({
          Bucket: scope.$ctrl.bucketName,
          Key: key,
          UploadId: file.uploadId,
          MultipartUpload: {}
        });
        done();
      }
    };

    // in order to allow access to 'scope' inside the dropzone
    // handler functions, the functions need to be wrapped in
    // scope.$apply.
    let eventHandlers = {
      'sending': (file, xhr, formData) => {
        scope.$apply(() => {
          // set form data prior to submitting the dz form
          scope.$ctrl.backend.updateFormData(scope.$ctrl.folder, file, formData)
            .then((data: any) => {
              console.log(data);
            });
        });

        // enable prompt when user attempts to navigate away from this page
        // while uploading a file
        window.onbeforeunload = function() {
          return true;
        };
      },
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
  }
}
