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
    let dropzoneConfig = {
      url: scope.$ctrl.config.url
    };

    let eventHandlers = {
      'sending': (file, xhr, formData) => {
        // append AWS upload key to the form data
        // needed in order to have a valid POST
        formData.append('key', file.name);
      }
    };

    let dropzone = new Dropzone(element[0], dropzoneConfig);

    angular.forEach(eventHandlers, (handler, event) => {
      dropzone.on(event, handler);
    });
  }
}
