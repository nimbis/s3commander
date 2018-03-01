import {UploadFormController} from './UploadFormController';

export const UploadFormComponent: angular.IComponentOptions = {
  bindings: {
    config: '=',
    folder: '='
  },
  template: require('./uploadForm.html'),
  controller: UploadFormController
};
