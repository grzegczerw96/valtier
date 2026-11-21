/** Fills the parts the desktop card and the phone sheet share: the brand in the
 *  lock-up, the detail rows and the call to action (a DS Button rendered in the
 *  markup, re-pointed here) or the plain "Visit ↗" link of an article. */
import type { Item } from './layout';

interface Sel { brand: string; rows: string; ctaWrap: string; cta: string; post: string }

const ctaLabel = (it: Item) => it.cta ?? (it.kind === 'shop' ? 'Shop Now' : it.kind === 'video' ? 'Watch the video' : 'Visit');
const isExternal = (href: string) => /^https?:\/\//.test(href);

export function fillCommon(root: HTMLElement, it: Item, s: Sel, anim: boolean) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  q(s.brand).textContent = it.brand || 'Valtier';

  const rows = q(s.rows);
  rows.replaceChildren();
  for (const d of it.details) {
    const row = document.createElement('div');
    row.className = 'jr-row';
    if (anim) row.dataset.anim = '';
    const a = document.createElement('span');
    a.textContent = d.label;
    const b = document.createElement('span');
    b.textContent = d.value;
    row.append(a, b);
    rows.append(row);
  }
  if (it.details.length) {
    const end = document.createElement('div');
    end.className = 'jr-rows__end';
    rows.append(end);
  }

  const hasCta = (it.kind === 'shop' || it.kind === 'link' || it.kind === 'video') && !!it.link;
  const wrap = q(s.ctaWrap);
  wrap.hidden = !hasCta;
  const cta = q<HTMLAnchorElement>(s.cta);
  if (hasCta) {
    cta.href = it.link!;
    if (isExternal(it.link!)) { cta.target = '_blank'; cta.rel = 'noreferrer'; }
    else { cta.removeAttribute('target'); cta.removeAttribute('rel'); }
    cta.querySelector('.btn__label')!.textContent = ctaLabel(it);
  }

  const post = q<HTMLAnchorElement>(s.post);
  const hasPost = it.kind === 'post' && !!it.link;
  post.hidden = !hasPost;
  if (hasPost) {
    post.href = it.link!;
    if (isExternal(it.link!)) { post.target = '_blank'; post.rel = 'noreferrer'; }
    else { post.removeAttribute('target'); post.removeAttribute('rel'); }
    post.textContent = `${it.cta ?? 'Visit'} ↗`;
  }
}
