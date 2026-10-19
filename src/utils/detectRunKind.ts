/**
 * Decides how the process was launched. A declared value wins, because a
 * launcher that names itself knows better than the file system does. The
 * container marker covers a launcher that nobody updated.
 */
export const detectRunKind = (declared: string | undefined, containerMarkerPresent: boolean): string => {
  const declaredKind = declared?.trim() ?? '';

  if (declaredKind !== '') {
    return declaredKind;
  }

  return containerMarkerPresent ? 'docker' : 'unknown';
};
