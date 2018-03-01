/**
 * Represents an object that describes a specific version of a file.
 */
export interface IFileVersion {
  latest: boolean;
  versionId: string;
  lastModified: Date;
  deleteMarker: boolean;
}
