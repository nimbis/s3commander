import {DropzoneController} from './DropzoneController';

export const DropzoneComponent: angular.IComponentOptions = {
  bindings: {
    config: '=',
    folder: '='
  },
  template: require('./dropzone.html'),
  controller: DropzoneController
};
