const result = document.getElementById('result')!;
const heading = '404 — Page not found';
const assertions: string[] = [];

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  assertions.push(message);
}

async function waitFor(condition: () => boolean, message: string) {
  const deadline = performance.now() + 6000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(message);
    await new Promise(requestAnimationFrame);
  }
}

async function verify(width: number) {
  const frame = document.createElement('iframe');
  frame.title = `Unknown route at ${width}px`;
  frame.style.cssText = `display:block;width:${width}px;height:800px;border:0`;
  const path = width === 320 ? '/missing-page' : '/products/1/missing-page';
  frame.src = path;
  document.body.append(frame);
  try {
    const view = frame.contentWindow!;
    const page = () => frame.contentDocument!;
    const main = () => page().querySelector('main');
    const atFallback = () => view.location.pathname === path && main()?.querySelector('h1')?.textContent === heading;
    await waitFor(atFallback, 'Direct URL must show the fallback');
    check(main()?.id === 'main-content' && page().querySelector('header') && page().querySelector('footer'), 'Fallback uses the shared layout');
    const beforeReload = page();
    view.location.reload();
    await waitFor(() => page() !== beforeReload && atFallback(), 'Reload must render the fallback in a new document');
    check(view.innerWidth === width && page().documentElement.scrollWidth <= width, 'Fallback fits the viewport');
    const link = main()?.querySelector<HTMLAnchorElement>('a[href="/"]');
    check(link, 'Fallback has a native homepage link');
    link.focus();
    check(page().activeElement === link && link.getBoundingClientRect().height >= 44, 'Homepage link takes focus and has a 44px target');
    const currentDocument = page();
    link.click();
    const atHomepage = () => view.location.pathname === '/' && Boolean(main()?.querySelector('h1')) && main()?.querySelector('h1')?.textContent !== heading;
    await waitFor(atHomepage, 'Homepage link must reach the valid route');
    await waitFor(() => atHomepage() && page().activeElement === main(), 'Homepage main landmark must receive focus');
    check(page() === currentDocument && page().activeElement === main(), 'Client navigation focuses the homepage main landmark');
    view.history.back();
    await waitFor(atFallback, 'Back must restore the unknown URL and fallback');
    check(page() === currentDocument, 'Back preserves the SPA document');
    view.history.forward();
    await waitFor(atHomepage, 'Forward must return to the homepage');
    check(page() === currentDocument, 'Forward preserves the SPA document');
  } finally {
    frame.remove();
  }
}

void (async () => {
  for (const width of [320, 375, 768, 1440]) await verify(width);
  result.textContent = `Unknown route checks passed. ${assertions.length} assertions.`;
})().catch((error: unknown) => {
  result.textContent = `Unknown route checks failed: ${error instanceof Error ? error.message : String(error)}`;
});
