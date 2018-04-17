import * as angular from 'angular';

import Dropzone = require('dropzone');

/**
 * Define new interface to allow accessing '$ctrl' from scope
 * https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18196
 */
interface IDropzoneDirectiveScope extends ng.IScope {
  $ctrl: any;
}

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
      maxFilesize: 1024,
      addRemoveLinks: true,
      dictCancelUpload: 'Cancel',
      dictDefaultMessage: 'Click here or Drop files here to upload'
    };

    // in order to allow access to 'scope' inside the dropzone
    // handler functions, the functions need to be wrapped in
    // scope.$apply.
    let eventHandlers = {
      'sending': (file, xhr, formData) => {
        scope.$apply(() => {
          // set form data prior to submitting the dz form
          scope.$ctrl.backend.updateFormData(scope.$ctrl.folder, file, formData);
        });
      }
    };

    let dropzone = new Dropzone(element[0], dropzoneConfig);

    angular.forEach(eventHandlers, (handler, event) => {
      dropzone.on(event, handler);
    });
  }
}
