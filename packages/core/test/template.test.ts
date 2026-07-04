// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compileItemTemplate, renderBlank } from '../src';

function makeTemplate(html: string): HTMLTemplateElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl;
}

describe('compileItemTemplate — rendering', () => {
  it('interpolates text bindings including dot paths', () => {
    const render = compileItemTemplate(
      makeTemplate('<h3>{{name}}</h3><p>{{specs.color}} — ${{price}}</p>'),
    );
    const frag = render({ name: 'Air Runner', price: 120, specs: { color: 'red' } });
    expect(frag.querySelector('h3')!.textContent).toBe('Air Runner');
    expect(frag.querySelector('p')!.textContent).toBe('red — $120');
  });

  it('interpolates attribute bindings', () => {
    const render = compileItemTemplate(makeTemplate('<img src="{{image}}" alt="{{name}}">'));
    const frag = render({ image: 'https://cdn.example.com/a.jpg', name: 'A' });
    const img = frag.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
    expect(img.getAttribute('alt')).toBe('A');
  });

  it('renders missing paths as empty strings', () => {
    const render = compileItemTemplate(makeTemplate('<span>{{does.not.exist}}</span>'));
    expect(render({}).querySelector('span')!.textContent).toBe('');
  });

  it('renderBlank produces the same structure with blank values (skeletons)', () => {
    const render = compileItemTemplate(makeTemplate('<article><h3>{{name}}</h3></article>'));
    const frag = renderBlank(render);
    expect(frag.querySelector('article h3')).not.toBeNull();
    expect(frag.querySelector('h3')!.textContent).toBe('');
  });
});

describe('compileItemTemplate — XSS safety', () => {
  it('never parses item data as HTML', () => {
    const render = compileItemTemplate(makeTemplate('<h3>{{name}}</h3>'));
    const frag = render({ name: '<img src=x onerror=alert(1)>' });
    expect(frag.querySelector('img')).toBeNull();
    expect(frag.querySelector('h3')!.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('strips on* event handler attributes from the template itself', () => {
    const render = compileItemTemplate(makeTemplate('<button onclick="alert(1)" onmouseover="x()">{{name}}</button>'));
    const btn = render({ name: 'hi' }).querySelector('button')!;
    expect(btn.hasAttribute('onclick')).toBe(false);
    expect(btn.hasAttribute('onmouseover')).toBe(false);
  });

  it('removes javascript:, data: and vbscript: URLs in url attributes', () => {
    const render = compileItemTemplate(makeTemplate('<a href="{{url}}">x</a>'));
    for (const evil of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,<script>', 'vbscript:x']) {
      const a = render({ url: evil }).querySelector('a')!;
      expect(a.hasAttribute('href')).toBe(false);
    }
  });

  it('keeps safe URLs: https, relative, anchors, mailto', () => {
    const render = compileItemTemplate(makeTemplate('<a href="{{url}}">x</a>'));
    for (const ok of ['https://example.com/p/1', '/products/1', './p', '#detail', 'mailto:a@b.c', 'products/1']) {
      const a = render({ url: ok }).querySelector('a')!;
      expect(a.getAttribute('href')).toBe(ok);
    }
  });
});
