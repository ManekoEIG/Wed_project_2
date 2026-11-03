'use strict';

/* =========================================================
   Пит-лист — ToDo-приложение на чистом JavaScript.
   В index.html только каркас и подключение этого скрипта:
   стили, разметка и вся логика создаются здесь через DOM API.
   ========================================================= */

/* =========================================================
   Утилиты для создания элементов
   ========================================================= */

// el('button', { className, text, attrs, dataset, on }, ...дочерние элементы)
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  const { className, text, attrs, dataset, on } = props;

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === true) node.setAttribute(name, '');
      else if (value !== false && value !== null && value !== undefined) node.setAttribute(name, value);
    });
  }
  if (dataset) Object.assign(node.dataset, dataset);
  if (on) Object.entries(on).forEach(([type, handler]) => node.addEventListener(type, handler));

  node.append(...children.filter(Boolean));
  return node;
}

const ICONS = {
  plus: 'M12 5v14M5 12h14',
};

function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon icon--${name}`);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/* =========================================================
   Состояние
   ========================================================= */

let refs = null; // ссылки на элементы, заполняются в buildLayout()

/* =========================================================
   Подключение стилей и построение страницы
   ========================================================= */

function connectStyles() {
  const links = [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,400;0,500;0,600;0,700;1,800;1,900&display=swap',
    },
    { rel: 'stylesheet', href: 'style.css' },
  ];
  links.forEach((attrs) => document.head.append(el('link', { attrs })));
  document.head.append(el('meta', { attrs: { name: 'theme-color', content: '#15151e' } }));
}

function buildLayout() {
  /* ---------- Шапка ---------- */
  const counter = el('p', { className: 'app-header__counter', attrs: { 'aria-live': 'polite' } });

  const headerInner = el('div', { className: 'app-header__inner' },
    el('p', { className: 'brand' },
      el('span', { className: 'brand__mark', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'brand__text', text: 'Пит-лист' })),
    el('h1', { className: 'app-title', text: 'Мои задачи' }),
    counter);

  const header = el('header', { className: 'app-header' },
    headerInner,
    el('div', { className: 'kerb', attrs: { 'aria-hidden': 'true' } }));

  /* ---------- Новая задача ---------- */
  const titleInput = el('input', {
    className: 'field__input',
    attrs: {
      id: 'new-title', name: 'title', type: 'text', placeholder: 'Что нужно сделать?',
      maxlength: '120', autocomplete: 'off', required: true, 'aria-describedby': 'new-title-error',
    },
  });
  const dateInput = el('input', { className: 'field__input', attrs: { id: 'new-date', name: 'date', type: 'date' } });
  const composerError = el('p', { className: 'field__error', attrs: { id: 'new-title-error', 'aria-live': 'polite' } });

  const composer = el('form', { className: 'composer', attrs: { novalidate: true } },
    el('div', { className: 'field field--grow' },
      el('label', { className: 'field__label', text: 'Задача', attrs: { for: 'new-title' } }),
      titleInput,
      composerError),
    el('div', { className: 'field field--date' },
      el('label', { className: 'field__label', text: 'Срок', attrs: { for: 'new-date' } }),
      dateInput),
    el('button', { className: 'button button--primary composer__submit', attrs: { type: 'submit' } },
      icon('plus'), el('span', { text: 'Добавить' })));

  const composerSection = el('section', { className: 'panel', attrs: { 'aria-labelledby': 'composer-title' } },
    el('h2', { className: 'visually-hidden', text: 'Новая задача', attrs: { id: 'composer-title' } }),
    composer);

  /* ---------- Список ---------- */
  const list = el('ul', { className: 'task-list', attrs: { id: 'task-list', 'aria-labelledby': 'list-title' } });
  const empty = el('div', { className: 'empty', attrs: { hidden: true } });

  const listSection = el('section', { className: 'tasks' },
    el('h2', { className: 'visually-hidden', text: 'Список задач', attrs: { id: 'list-title' } }),
    list,
    empty);

  /* ---------- Подвал ---------- */
  const footerText = 'Пит-лист — учебный проект на чистом JavaScript.';
  const footerInner = el('div', { className: 'app-footer__inner' }, el('p', { text: footerText }));
  const footer = el('footer', { className: 'app-footer' }, footerInner);

  const main = el('main', { className: 'app' }, composerSection);
  main.append(listSection);

  document.body.append(header, main, footer);

  return {
    counter, composer, titleInput, dateInput, composerError, list, empty,
  };
}

/* =========================================================
   Запуск
   ========================================================= */

connectStyles();
refs = buildLayout();
refs.counter.textContent = 'Задач пока нет';
