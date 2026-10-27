export function getGonShareUrl(linkId: string): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('page', 'bringAnyIdeaToLife');
  url.searchParams.set('linkid', linkId);
  return url.toString();
}

/** Open the native share sheet when available, otherwise copy a direct link. */
export async function shareGonCreation(linkId: string, title: string): Promise<void> {
  const url = getGonShareUrl(linkId);
  const shareData = {
    title: title || 'GON',
    text: 'Xem video và trải nghiệm nội dung GON này:',
    url,
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      // User cancelling the native share sheet is not an error and should not
      // trigger an unexpected clipboard write.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  window.prompt('Sao chép link GON để chia sẻ:', url);
}
