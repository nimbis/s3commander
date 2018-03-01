/**
 * An object that represents a specific version of a file.
 */
export interface IFileVersion {
  /**
   * Whether this version is currently the latest available one.
   */
  latest: boolean;

  /**
   * Unique version identifier.
   */
  versionId: string;

  /**
   * Last modified timestamp.
   */
  lastModified: Date;

  /**
   * Whether this version represents a deletion marker.
   */
  deleteMarker: boolean;

  /**
   * Link to download this specific verison of a file. Not applicable for
   * delete markers.
   */
  downloadLink: string;
}
