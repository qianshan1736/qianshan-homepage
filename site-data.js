const FEISHU_API_BASE = 'https://qianshan-homepage-d5dbe6ce091c85-1305986389.ap-shanghai.app.tcloudbase.com';

const PAGE_LABELS = {
  home: '首页',
  works: '作品',
  notes: '随记',
  about: '关于'
};

const WORK_VISUAL_CLASSES = ['visual-a', 'visual-b', 'visual-c'];

const HOME_DEFAULTS = {
  tags: ['乐子人', '健忘者'],
  title: '找乐子的千山',
  lead: '人在搬砖，心在登山',
  intro: '这里收放作品、观察和一些微小的乐子信号。认真工作，也认真从生活的噪声里截获一点喘气的空间。',
  moments: []
};

const ABOUT_DEFAULTS = {
  eyebrow: '',
  title: '你好\n我是找乐子的千山',
  lead: '一个忙里偷闲，尝试给自己找点乐子的人',
  body: [
    '这个网站用来存放作品、生活片段和一些不太正经的观察。它提醒我：日子可以很忙，但精神系统不能一直满负荷运行。',
    '你可以把这里当成一个小型个人终端：看看我做过什么、记下什么，也顺手截获一点轻松。'
  ],
  contactText: '欢迎通过微信接入频道。'
};

const PLACEHOLDER_TEXT = new Set([
  '暂时没有介绍',
  '暂无介绍',
  '没有介绍',
  '工作那么累，必须在生活中找点乐子放松下',
  '工作那么累，为什么不在生活中找点乐子放松下。',
  '认真生活，也认真给自己留一点喘气的空间。',
  '一个会认真工作，也会认真从日常系统里捞点乐子的人。',
  '一个会认真工作，也会认真给生活找点乐子的人。',
  '请稍后再试。',
  '稍等一下，正在取最新内容。'
]);

const LEGACY_MOMENTS = new Set([
  '路过一家很会晒太阳的咖啡店',
  '把麻烦事拆成一个能完成的小动作',
  '在普通日子里捡到一点轻松'
]);

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    if (value > 1000000000000) {
      return new Date(value).toLocaleDateString('zh-CN');
    }

    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join('\n').trim();
  }

  if (typeof value === 'object') {
    return normalizeText(value.text || value.name || value.title || value.link || value.url || value.value || '');
  }

  return String(value).trim();
}

function normalizeList(value) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return normalizeText(value)
    .split(/[\n,，、/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderAboutTitle(title) {
  return normalizeText(title)
    .split(/\n+|，|,/)
    .map((line) => line.replace(/[。.!！?？]+$/g, '').trim())
    .filter(Boolean)
    .map((line) => `<span>${escapeHtml(line)}</span>`)
    .join('');
}

function normalizeLink(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const firstLink = value.find((item) => item && (item.link || item.url || item.text));
    return firstLink ? normalizeLink(firstLink) : '';
  }

  if (typeof value === 'object') {
    return String(value.link || value.url || value.text || '').trim();
  }

  return '';
}

function getField(fields, names, fallback = '') {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
      const text = normalizeText(fields[name]);
      if (text) {
        return text;
      }
    }
  }

  return fallback;
}

function polishText(value, fallback) {
  const text = normalizeText(value);
  return text && !PLACEHOLDER_TEXT.has(text) ? text : fallback;
}

function polishMoment(value, index) {
  return LEGACY_MOMENTS.has(value) ? HOME_DEFAULTS.moments[index] || value : value;
}

function getLinkField(fields, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
      const link = normalizeLink(fields[name]);
      if (link) {
        return link;
      }
    }
  }

  return '';
}

function getImageField(fields, names) {
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(fields, name)) {
      continue;
    }

    const value = fields[name];
    const image = Array.isArray(value) ? value[0] : value;
    if (image && typeof image === 'object') {
      const url = proxiedFeishuImageUrl(image) || image.tmp_url || image.url || image.link;
      if (url) {
        return {
          url: String(url),
          alt: normalizeText(image.name || name)
        };
      }
    }

    const link = normalizeLink(value);
    if (link) {
      return {
        url: link,
        alt: name
      };
    }
  }

  return null;
}

function proxiedFeishuImageUrl(image) {
  const fileToken = image.file_token || image.fileToken;
  if (!fileToken) {
    return '';
  }

  const url = new URL('/api/media', FEISHU_API_BASE);
  url.searchParams.set('file_token', fileToken);

  const sourceUrl = image.url || image.tmp_url || '';
  if (sourceUrl) {
    try {
      const source = new URL(sourceUrl);
      const extra = source.searchParams.get('extra');
      if (extra) {
        url.searchParams.set('extra', extra);
      }
    } catch {
      // Ignore malformed Feishu attachment URLs and use token-only proxying.
    }
  }

  if (image.type) {
    url.searchParams.set('type', image.type);
  }

  if (image.name) {
    url.searchParams.set('name', image.name);
  }

  return url.toString();
}

function setCssImageVariableWhenAvailable(name, image) {
  if (!image || !image.url) {
    return;
  }

  const probe = new Image();
  probe.onload = () => {
    document.documentElement.style.setProperty(name, `url("${image.url}")`);
  };
  probe.src = image.url;
}

function recordFields(record) {
  return record && record.fields ? record.fields : {};
}

function recordId(record) {
  return record && (record.record_id || record.id) ? record.record_id || record.id : '';
}

async function loadPageRecords(page, pageSize = 50) {
  const url = new URL('/api/records', FEISHU_API_BASE);
  url.searchParams.set('page', page);
  url.searchParams.set('page_size', String(pageSize));

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || `${PAGE_LABELS[page] || '页面'}数据加载失败`);
  }

  return data.items || [];
}

function renderWorkCards(container, records, options = {}) {
  const works = records
    .map(recordFields)
    .map((fields) => ({
      title: getField(fields, ['名称', '标题', '作品名', '项目名称']),
      intro: getField(fields, ['介绍', '简介', '摘要', '描述', '内容']),
      category: getField(fields, ['分类', '类型', '标签']),
      date: getField(fields, ['年份', '日期', '时间', '发布于'], ''),
      image: getImageField(fields, ['图片', '封面', '作品图片', '截图']),
      link: getLinkField(fields, ['链接', 'URL', '地址', '作品链接'])
    }))
    .filter((work) => work.title)
    .slice(0, options.limit || records.length);

  if (works.length === 0) {
    container.innerHTML = stateCard('乐子库暂时空着', '接入「名称」或「标题」后，项目会自动进入乐子库。', '待接入');
    return;
  }

  container.innerHTML = works.map((work, index) => {
    const title = escapeHtml(work.title);
    const link = escapeHtml(work.link);
    const titleHtml = work.link
      ? `<a class="work-title-link" href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>`
      : title;
    const metaHtml = work.category || work.date
      ? `
        <div class="card-meta">
          <span>${escapeHtml(work.category || '作品')}</span>
          <span>${escapeHtml(work.date || '')}</span>
        </div>
      `
      : '';

    return `
      <article class="work-card">
        ${
          work.image
            ? `<div class="visual work-image"><img src="${escapeHtml(work.image.url)}" alt="${escapeHtml(work.image.alt || work.title)}" loading="lazy" onerror="this.closest('.work-image').classList.add('image-failed'); this.remove();"></div>`
            : `<div class="visual ${WORK_VISUAL_CLASSES[index % WORK_VISUAL_CLASSES.length]}"></div>`
        }
        ${metaHtml}
        <h3>${titleHtml}</h3>
        <p>${escapeHtml(work.intro || '这条作品还没有写入说明，先把信号保留在这里。')}</p>
      </article>
    `;
  }).join('');
}

function renderNoteRows(container, records, options = {}) {
  const notes = records
    .map((record) => ({
      fields: recordFields(record),
      id: recordId(record)
    }))
    .map((noteRecord) => {
      const fields = noteRecord.fields;
      return {
        title: getField(fields, ['标题', '名称', '随记标题']),
        summary: getField(fields, ['摘要', '简介', '内容', '正文', '描述']),
        date: getField(fields, ['发布时间', '日期', '时间', '发布于', '年份'], ''),
        link: noteRecord.id ? `note.html?id=${encodeURIComponent(noteRecord.id)}` : getLinkField(fields, ['文章链接', '链接', 'URL', '地址'])
      };
    })
    .filter((note) => note.title)
    .slice(0, options.limit || records.length);

  if (notes.length === 0) {
    container.innerHTML = stateCard('还没有新的记录', '写入「标题」后，随记会自动出现在这里。', '待接入');
    return;
  }

  container.innerHTML = notes.map((note) => {
    const title = escapeHtml(note.title);
    const titleHtml = note.link
      ? `<a href="${escapeHtml(note.link)}">${title}</a>`
      : title;

    return `
      <article class="note-card">
        <div>
          <time>${escapeHtml(note.date || '未标日期')}</time>
          <h3>${titleHtml}</h3>
          <p>${escapeHtml(note.summary || '这条随记还没有写入摘要，先保留为一段未解码信号。')}</p>
        </div>
      </article>
    `;
  }).join('');
}

function stateCard(title, text, label = '提示') {
  return `
    <article class="work-card state-card">
      <div class="visual visual-empty"></div>
      <div class="card-meta">
        <span>${escapeHtml(label)}</span>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

async function mountHomePage() {
  const heroCopy = document.querySelector('[data-home-copy]');
  const homeTags = document.querySelector('[data-home-tags]');
  const worksGrid = document.querySelector('[data-works-preview]');
  const notesGrid = document.querySelector('[data-notes-preview]');

  try {
    const [homeRecords, workRecords, noteRecords] = await Promise.all([
      loadPageRecords('home', 10),
      loadPageRecords('works', 3),
      loadPageRecords('notes', 3)
    ]);

    const homeFields = recordFields(homeRecords[0]);
    const title = polishText(getField(homeFields, ['账号名称', '标题', '名称', '主标题']), HOME_DEFAULTS.title);
    const lead = polishText(getField(homeFields, ['副标题', '标语', '简介']), HOME_DEFAULTS.lead);
    const intro = polishText(getField(homeFields, ['个人介绍', '介绍', '正文', '描述', '内容']), HOME_DEFAULTS.intro);
    const tags = normalizeList(homeFields['标签'] || homeFields['眉标'] || homeFields['分类']);
    const avatar = getImageField(homeFields, ['头像', '头像图片']);
    const heroBg = getImageField(homeFields, ['背景图片', '首页背景', '背景图']);

    setCssImageVariableWhenAvailable('--avatar-image', avatar);
    setCssImageVariableWhenAvailable('--hero-bg-image', heroBg);

    if (homeTags) {
      const nextTags = tags.length > 0 ? tags : HOME_DEFAULTS.tags;
      homeTags.innerHTML = nextTags.map((tag) => `<span class="eyebrow">${escapeHtml(tag)}</span>`).join('');
    }

    if (heroCopy && (title || lead || intro)) {
      heroCopy.querySelector('h1').textContent = title;
      heroCopy.querySelector('.lead').textContent = lead;
      heroCopy.querySelector('.intro').textContent = intro;
    }

    if (worksGrid) {
      renderWorkCards(worksGrid, workRecords, { limit: 3 });
    }

    if (notesGrid) {
      renderNoteRows(notesGrid, noteRecords, { limit: 3 });
    }
  } catch (error) {
    if (worksGrid) {
      worksGrid.innerHTML = stateCard('首页频道连接超时', error.message || '稍后重新扫描。', '异常');
    }
  }
}

async function mountWorksPage() {
  const worksGrid = document.querySelector('[data-works-grid]');
  if (!worksGrid) {
    return;
  }

  try {
    renderWorkCards(worksGrid, await loadPageRecords('works', 100));
  } catch (error) {
    worksGrid.innerHTML = stateCard('作品频道连接超时', error.message || '稍后重新扫描。', '异常');
  }
}

async function mountNotesPage() {
  const notesGrid = document.querySelector('[data-notes-grid]');
  if (!notesGrid) {
    return;
  }

  try {
    renderNoteRows(notesGrid, await loadPageRecords('notes', 100));
  } catch (error) {
    notesGrid.innerHTML = stateCard('记录连接超时', error.message || '稍后再翻一次。', '异常');
  }
}

function renderArticleHtml(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    html.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      flushParagraph();
      return;
    }

    if (/^---+$/.test(text)) {
      flushParagraph();
      html.push('<hr>');
      return;
    }

    const heading = text.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      return;
    }

    paragraph.push(text);
  });

  flushParagraph();
  return html.join('');
}

async function mountNoteDetailPage() {
  const article = document.querySelector('[data-note-detail]');
  if (!article) {
    return;
  }

  try {
    const id = new URLSearchParams(window.location.search).get('id');
    const records = await loadPageRecords('notes', 100);
    const record = id
      ? records.find((item) => recordId(item) === id)
      : records[0];

    if (!record) {
      article.innerHTML = '<p>没有找到这段记录。</p>';
      return;
    }

    const fields = recordFields(record);
    const title = getField(fields, ['标题', '名称', '随记标题'], '未命名随记');
    const date = getField(fields, ['发布时间', '日期', '时间', '发布于', '年份']);
    const summary = getField(fields, ['摘要', '简介', '描述']);
    const body = getField(fields, ['正文内容', '正文', '内容'], summary);
    const sourceLink = getLinkField(fields, ['文章链接', '链接', 'URL', '地址']);

    document.title = `${title} · 找乐子的千山`;
    article.innerHTML = `
      <a class="back-link" href="notes.html">返回随记</a>
      <header class="article-head">
        <p class="eyebrow">${escapeHtml(date || '随记')}</p>
        <h1>${escapeHtml(title)}</h1>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
      </header>
      <div class="article-body">
        ${renderArticleHtml(body)}
      </div>
      ${sourceLink ? `<a class="button ghost article-source" href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener noreferrer">打开原文</a>` : ''}
    `;
  } catch (error) {
    article.innerHTML = `<p>${escapeHtml(error.message || '这段记录暂时没翻出来。')}</p>`;
  }
}

async function mountAboutPage() {
  const aboutMain = document.querySelector('[data-about-main]');
  const contactCard = document.querySelector('[data-contact-card]');
  if (!aboutMain && !contactCard) {
    return;
  }

  try {
    const records = await loadPageRecords('about', 10);
    const fields = recordFields(records[0]);
    const eyebrow = polishText(getField(fields, ['眉标', '标签', '分类']), ABOUT_DEFAULTS.eyebrow);
    const title = polishText(getField(fields, ['欢迎语', '标题', '名称', '主标题']), ABOUT_DEFAULTS.title);
    const lead = polishText(getField(fields, ['副标题', '标语', '简介']), ABOUT_DEFAULTS.lead);
    const body = polishText(getField(fields, ['介绍', '正文', '描述', '内容']), ABOUT_DEFAULTS.body.join('\n'));
    const contactTitle = getField(fields, ['联系方式标题', '联系标题'], '微信');
    const contactText = polishText(getField(fields, ['联系方式说明', '联系说明']), ABOUT_DEFAULTS.contactText);
    const wechat = getField(fields, ['微信', '微信号', '联系方式'], '微信');
    const wechatImage = getImageField(fields, ['联系方式-微信二维码', '微信二维码', '二维码']);

    if (aboutMain && (title || lead || body)) {
      const eyebrowNode = aboutMain.querySelector('.eyebrow');
      const titleNode = aboutMain.querySelector('h1');
      const leadNode = aboutMain.querySelector('.lead');
      const bodyNode = aboutMain.querySelector('[data-about-body]');
      if (eyebrowNode) {
        eyebrowNode.textContent = eyebrow;
        eyebrowNode.hidden = !eyebrow;
      }
      if (titleNode) {
        titleNode.innerHTML = renderAboutTitle(title);
      }
      if (leadNode) {
        leadNode.textContent = lead;
      }
      if (bodyNode) {
        bodyNode.innerHTML = body
          ? body.split(/\n+/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
          : '';
      }
    }

    if (contactCard) {
      const contactTitleNode = contactCard.querySelector('h2');
      const contactTextNode = contactCard.querySelector('p');
      const wechatNode = contactCard.querySelector('.wechat');
      if (contactTitleNode) {
        contactTitleNode.textContent = contactTitle;
      }
      if (contactTextNode) {
        contactTextNode.textContent = contactText;
      }
      if (wechatNode) {
        wechatNode.innerHTML = wechatImage
          ? `<img src="${escapeHtml(wechatImage.url)}" alt="${escapeHtml(wechatImage.alt || '微信二维码')}" loading="lazy" onerror="this.parentElement.textContent='${escapeHtml(wechat)}';">`
          : escapeHtml(wechat);
      }
    }
  } catch (error) {
    if (aboutMain) {
      const bodyNode = aboutMain.querySelector('[data-about-body]');
      if (bodyNode) {
        bodyNode.innerHTML = `<p>${escapeHtml(error.message || '身份档案连接失败。')}</p>`;
      }
    }
  }
}

const pageMounts = {
  home: mountHomePage,
  works: mountWorksPage,
  notes: mountNotesPage,
  note: mountNoteDetailPage,
  about: mountAboutPage
};

const pageName = document.body.dataset.page;
if (pageMounts[pageName]) {
  pageMounts[pageName]();
}
