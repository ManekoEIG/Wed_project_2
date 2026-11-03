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
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12.5l4.5 4.5L19 7',
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

function plural(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const shorten = (text, max = 40) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const createId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* =========================================================
   Даты (храним в формате ГГГГ-ММ-ДД, как у <input type="date">)
   ========================================================= */

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const todayISO = () => toISO(new Date());

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function describeDate(iso, done) {
  if (!iso) return { text: 'Без срока', state: 'none' };

  const date = parseISO(iso);
  const diff = Math.round((date - parseISO(todayISO())) / 86400000);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const formatted = date.toLocaleDateString('ru-RU', sameYear
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });

  if (diff === 0) return { text: `Сегодня, ${formatted}`, state: 'today' };
  if (diff === 1) return { text: `Завтра, ${formatted}`, state: 'soon' };
  if (diff < 0 && !done) return { text: `Просрочено: ${formatted}`, state: 'overdue' };
  return { text: formatted, state: 'future' };
}

/* =========================================================
   Задачи
   ========================================================= */

function makeTask(title, date = '', done = false) {
  return { id: createId(), title, date, done, createdAt: Date.now() };
}

/* =========================================================
   Состояние
   ========================================================= */

let tasks = [];
let editingId = null;
let pendingFocus = null; // { id, selector } — куда вернуть фокус после перерисовки
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
  const progressBar = el('span', { className: 'progress__bar' });

  const headerInner = el('div', { className: 'app-header__inner' },
    el('p', { className: 'brand' },
      el('span', { className: 'brand__mark', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'brand__text', text: 'Пит-лист' })),
    el('h1', { className: 'app-title', text: 'Мои задачи' }),
    counter);
  headerInner.append(el('div', { className: 'progress', attrs: { 'aria-hidden': 'true' } }, progressBar));

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

  const toast = el('div', { className: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } });

  const main = el('main', { className: 'app' }, composerSection);
  main.append(listSection);

  document.body.append(header, main, footer);
  document.body.append(toast);

  return {
    counter, composer, titleInput, dateInput, composerError, list, empty,
    toast,
    progressBar,
  };
}

/* =========================================================
   Отрисовка
   ========================================================= */

function getVisibleTasks() {
  return tasks.slice();
}

const visibleIds = () => [...refs.list.children].map((li) => li.dataset.id);

function createTaskItem(task) {
  const isEditing = editingId === task.id;
  const info = describeDate(task.date, task.done);

  const classes = ['task'];
  if (task.done) classes.push('task--done');
  if (isEditing) classes.push('task--editing');
  if (info.state === 'overdue') classes.push('task--overdue');

  const item = el('li', { className: classes.join(' '), dataset: { id: task.id } });

  if (isEditing) {
    item.append(createEditForm(task));
    return item;
  }

  const checkbox = el('input', {
    className: 'task__checkbox',
    attrs: { type: 'checkbox', 'aria-label': `Выполнено: ${task.title}` },
    dataset: { action: 'toggle' },
  });
  checkbox.checked = task.done;

  const check = el('label', { className: 'task__check' },
    checkbox,
    el('span', { className: 'task__checkmark', attrs: { 'aria-hidden': 'true' } }, icon('check')));

  const title = el('p', { className: 'task__title', text: task.title });
  title.title = 'Дважды щёлкните, чтобы изменить';

  const date = el(task.date ? 'time' : 'span', {
    className: `task__date task__date--${info.state}`,
    text: info.text,
    attrs: task.date ? { datetime: task.date } : {},
  });

  const body = el('div', { className: 'task__body' }, title, date);

  const actions = el('div', { className: 'task__actions' });
  actions.append(el('button', {
    className: 'icon-button',
    attrs: { type: 'button', title: 'Изменить', 'aria-label': `Изменить «${task.title}»` },
    dataset: { action: 'edit' },
  }, icon('edit')));
  actions.append(el('button', {
    className: 'icon-button icon-button--danger',
    attrs: { type: 'button', title: 'Удалить', 'aria-label': `Удалить «${task.title}»` },
    dataset: { action: 'delete' },
  }, icon('trash')));

  item.append(check);
  item.append(body, actions);
  return item;
}

function createEditForm(task) {
  const titleId = `edit-title-${task.id}`;
  const dateId = `edit-date-${task.id}`;
  const errorId = `edit-error-${task.id}`;

  const titleInput = el('input', {
    className: 'field__input',
    attrs: { id: titleId, type: 'text', maxlength: '120', required: true, autocomplete: 'off', 'aria-describedby': errorId },
  });
  titleInput.value = task.title;

  const dateInput = el('input', { className: 'field__input', attrs: { id: dateId, type: 'date' } });
  dateInput.value = task.date;

  const error = el('p', { className: 'field__error', attrs: { id: errorId, 'aria-live': 'polite' } });

  const form = el('form', {
    className: 'task__edit',
    attrs: { novalidate: true, 'aria-label': `Редактирование задачи «${task.title}»` },
  },
    el('div', { className: 'field field--grow' },
      el('label', { className: 'field__label', text: 'Название', attrs: { for: titleId } }),
      titleInput,
      error),
    el('div', { className: 'field field--date' },
      el('label', { className: 'field__label', text: 'Срок', attrs: { for: dateId } }),
      dateInput),
    el('div', { className: 'task__edit-actions' },
      el('button', { className: 'button button--primary', text: 'Сохранить', attrs: { type: 'submit' } }),
      el('button', { className: 'button button--ghost', text: 'Отмена', attrs: { type: 'button' }, dataset: { action: 'cancel' } })));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      error.textContent = 'Название не может быть пустым';
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      return;
    }
    updateTask(task.id, { title, date: dateInput.value });
    editingId = null;
    pendingFocus = { id: task.id, selector: '[data-action="edit"]' };
    render();
    showToast('Изменения сохранены');
  });

  titleInput.addEventListener('input', () => {
    error.textContent = '';
    titleInput.removeAttribute('aria-invalid');
  });

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit(task.id);
    }
  });

  return form;
}

function renderEmptyState(visibleCount) {
  if (visibleCount > 0) {
    refs.empty.hidden = true;
    refs.empty.replaceChildren();
    return;
  }

  refs.empty.hidden = false;
  refs.empty.replaceChildren(
    el('p', { className: 'empty__title', text: 'Список пуст' }),
    el('p', { text: 'Добавьте первую задачу в форме выше.' }));
}

function renderHeader() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const active = total - done;

  if (total === 0) refs.counter.textContent = 'Задач пока нет';
  else if (active === 0) refs.counter.textContent = `Всё выполнено: ${total} ${plural(total, ['задача', 'задачи', 'задач'])}`;
  else refs.counter.textContent = `Осталось ${active} из ${total}`;

  // Ширина полосы прогресса задаётся из JS
  refs.progressBar.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;

}

function render() {
  const visible = getVisibleTasks();
  refs.list.replaceChildren(...visible.map(createTaskItem));

  renderEmptyState(visible.length);
  renderHeader();

  if (pendingFocus) {
    const { id, selector } = pendingFocus;
    pendingFocus = null;
    const target = refs.list.querySelector(`[data-id="${id}"] ${selector}`);
    if (target) {
      target.focus();
      if (target.select && target.type === 'text') target.select();
    }
  }
}

/* =========================================================
   Действия с задачами
   ========================================================= */

function addTask(title, date) {
  const task = makeTask(title, date);
  tasks.unshift(task);

  render();
  showToast('Задача добавлена');
}

function updateTask(id, changes) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  Object.assign(task, changes);
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  pendingFocus = { id, selector: '[data-action="toggle"]' };
  render();
  if (task.done) showToast('Задача выполнена');
}

function deleteTask(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return;

  // Фокус переходит на соседнюю задачу
  const ids = visibleIds();
  const position = ids.indexOf(id);
  const neighbourId = ids[position + 1] ?? ids[position - 1];
  if (neighbourId) pendingFocus = { id: neighbourId, selector: '[data-action="delete"]' };

  const [removed] = tasks.splice(index, 1);
  if (editingId === id) editingId = null;
  render();

  showToast(`Задача «${shorten(removed.title)}» удалена`, {
    label: 'Отменить',
    run: () => {
      tasks.splice(Math.min(index, tasks.length), 0, removed);
      pendingFocus = { id: removed.id, selector: '[data-action="delete"]' };
      render();
    },
  });
}

function startEdit(id) {
  editingId = id;
  pendingFocus = { id, selector: 'input[type="text"]' };
  render();
}

function cancelEdit(id) {
  editingId = null;
  pendingFocus = { id, selector: '[data-action="edit"]' };
  render();
}

/* =========================================================
   Уведомления
   ========================================================= */

let toastTimer;

function hideToast() {
  refs.toast.classList.remove('toast--visible');
}

function showToast(message, action) {
  if (!refs) return;
  const children = [el('span', { text: message })];
  if (action) {
    children.push(el('button', {
      className: 'toast__action',
      text: action.label,
      attrs: { type: 'button' },
      on: {
        click: () => {
          hideToast();
          action.run();
        },
      },
    }));
  }
  refs.toast.replaceChildren(...children);
  refs.toast.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5000 : 2200);
}

/* =========================================================
   Обработчики
   ========================================================= */

function setupEvents() {
  // Новая задача
  refs.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = refs.titleInput.value.trim();
    if (!title) {
      refs.composerError.textContent = 'Введите название задачи';
      refs.titleInput.setAttribute('aria-invalid', 'true');
      refs.titleInput.focus();
      return;
    }
    addTask(title, refs.dateInput.value);
    refs.composer.reset();
    refs.titleInput.focus();
  });

  refs.titleInput.addEventListener('input', () => {
    refs.composerError.textContent = '';
    refs.titleInput.removeAttribute('aria-invalid');
  });

  // Кнопки внутри задач (делегирование)
  refs.list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    const item = event.target.closest('.task');
    if (!button || !item) return;
    const { id } = item.dataset;

    if (button.dataset.action === 'edit') startEdit(id);
    if (button.dataset.action === 'delete') deleteTask(id);
    if (button.dataset.action === 'cancel') cancelEdit(id);
  });

  // Отметка «выполнено»
  refs.list.addEventListener('change', (event) => {
    if (event.target.matches('[data-action="toggle"]')) toggleTask(event.target.closest('.task').dataset.id);
  });

  // Редактирование двойным щелчком по названию
  refs.list.addEventListener('dblclick', (event) => {
    const title = event.target.closest('.task__title');
    if (title) startEdit(title.closest('.task').dataset.id);
  });

}

/* =========================================================
   Запуск
   ========================================================= */

connectStyles();
refs = buildLayout();
setupEvents();
render();
