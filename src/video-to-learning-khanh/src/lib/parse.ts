export const parseJSON = (str: string) => {
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}') + 1;
  return JSON.parse(str.substring(start, end));
};

export const parseHTML = (str: string, closer: string) => {
  const start = str.indexOf('<!DOCTYPE html>');
  const end = str.lastIndexOf(closer);
  if (start === -1) return str.trim();
  return str.substring(start, end === -1 ? undefined : end).trim();
};
