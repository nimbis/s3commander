import {FolderController} from './FolderController';

export const FolderComponent: angular.IComponentOptions = {
  bindings: {
    folder: '=',
    onNavigate: '&',
    onDelete: '&'
  },
  template: require('./folder.html'),
  controller: FolderController
};
