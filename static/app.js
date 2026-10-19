/* 松江小微企信 · 无后端静态版 */

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
    if (tab.dataset.target === 'page-warning') loadWarnings();
  });
});

const levelColor = {A:'#22a06b', B:'#2b5cff', C:'#f5a623', D:'#e5433e'};

function ruleScore(d) {
  const detail = [];
  const years = d['成立年限'];
  const s1 = years >= 5 ? 15 : years >= 3 ? 12 : years >= 2 ? 8 : 4;
  detail.push({维度:'经营稳定性', 得分:s1, 满分:15, 说明:`成立 ${years} 年`});

  const capital = d['注册资本(万元)'];
  const s2 = capital >= 300 ? 15 : capital >= 100 ? 12 : capital >= 50 ? 8 : 4;
  detail.push({维度:'规模实力', 得分:s2, 满分:15, 说明:`注册资本 ${capital} 万元`});

  const revenue = d['近12月营收(万元)'];
  const s3 = revenue >= 500 ? 20 : revenue >= 200 ? 15 : revenue >= 100 ? 10 : revenue >= 50 ? 5 : 4;
  detail.push({维度:'盈利能力', 得分:s3, 满分:20, 说明:`近12月营收 ${revenue} 万元`});

  const tax = d['纳税状态'];
  const s4 = tax.includes('A级') ? 20 : tax === '正常' ? 14 : tax === '欠税' ? 8 : 4;
  detail.push({维度:'履约守信', 得分:s4, 满分:20, 说明:`纳税状态：${tax}`});

  const lawsuits = d['司法涉诉数'];
  const s5 = Math.max(0, 15 - lawsuits * 5);
  detail.push({维度:'风险信号', 得分:s5, 满分:15, 说明:`司法涉案 ${lawsuits} 条`});

  const penalties = d['行政处罚数'];
  const abnormal = d['经营异常数'];
  const s6 = Math.max(0, 15 - penalties * 6 - abnormal * 5);
  detail.push({维度:'合规记录', 得分:s6, 满分:15, 说明:`行政处罚 ${penalties} 条、经营异常 ${abnormal} 次`});
  return {基础分:s1 + s2 + s3 + s4 + s5 + s6, 明细:detail};
}

function hardRule(info) {
  const desc = info['风险描述'] || '';
  if (['失信', '强制执行', '终本'].some(key => desc.includes(key))) return '存在失信被执行人/强制执行记录';
  if (info['经营异常数'] >= 2) return `近3年被列入经营异常名录 ${info['经营异常数']} 次`;
  if (info['司法涉诉数'] >= 3) return `司法涉案 ${info['司法涉诉数']} 起`;
  if (info['行政处罚数'] >= 2) return `行政处罚 ${info['行政处罚数']} 次`;
  return '';
}

function scoreToLevel(score) {
  return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
}

function evaluate(info) {
  const base = ruleScore(info);
  let score = base.基础分;
  const desc = info['风险描述'] || '';
  ['失信', '被执行', '冻结', '起诉', '异常名录', '限制高消费'].forEach(key => { if (desc.includes(key)) score -= 5; });
  ['投诉', '处罚', '纠纷', '仲裁', '差评'].forEach(key => { if (desc.includes(key)) score -= 2; });
  score = Math.max(0, Math.min(100, score));

  const override = hardRule(info);
  if (override) score = Math.min(score, 48);
  const level = scoreToLevel(score);
  const reasons = [];
  if (override) reasons.push(`❌ 触发硬规则：${override}`);
  base.明细.forEach(item => {
    const ratio = item.得分 / item.满分;
    reasons.push(`${ratio >= .8 ? '✅' : ratio >= .5 ? '⚠️' : '❌'} ${item.维度}${ratio >= .8 ? '良好' : ratio >= .5 ? '一般' : '偏弱'}（${item.说明}）`);
  });
  if (desc && desc !== '无') reasons.push(`📄 风险描述：${desc}`);

  const advice = {
    A:'经营稳健，建议按标准流程授信，额度可上浮，贷后按季度监控。',
    B:'整体可控，建议正常授信，利率小幅上浮，贷后每季度回访一次。',
    C:'存在一定风险，建议审慎授信、降低额度、提高利率，加强贷后监控。',
    D:'风险较高，建议暂缓授信或要求追加担保，列入重点关注名单。'
  }[level];
  return {信用评分:score, 信用等级:level, 评估理由:reasons, 授信建议:advice, 规则明细:base.明细, 规则基础分:base.基础分, 引擎:'本地规则引擎 + 硬规则'};
}

document.getElementById('btn-evaluate').addEventListener('click', () => {
  const name = val('f-name');
  if (!name) {
    document.getElementById('f-name').focus();
    alert('请先输入企业名称。');
    return;
  }
  const payload = {
    '企业名称':name,
    '所属行业':val('f-industry'),
    '成立年限':num('f-years'),
    '注册资本(万元)':num('f-capital'),
    '近12月营收(万元)':num('f-revenue'),
    '纳税状态':val('f-tax'),
    '社保人数':num('f-social'),
    '司法涉诉数':num('f-lawsuit'),
    '行政处罚数':num('f-penalty'),
    '经营异常数':num('f-abnormal'),
    '风险描述':val('f-desc')
  };
  renderResult(evaluate(payload));
});

function renderResult(r) {
  const card = document.getElementById('result-card');
  card.style.display = 'block';
  const score = Number(r.信用评分 || 0);
  const level = r.信用等级 || '-';
  const color = levelColor[level] || '#2b5cff';
  const scoreNode = document.getElementById('r-score');
  scoreNode.textContent = score;
  scoreNode.style.color = color;
  const badge = document.getElementById('r-level');
  badge.textContent = `${level} 级`;
  badge.style.background = color;
  const bar = document.getElementById('r-bar');
  bar.style.width = '0';
  setTimeout(() => { bar.style.width = `${score}%`; bar.style.background = color; }, 50);

  const reasons = document.getElementById('r-reasons');
  reasons.replaceChildren(...r.评估理由.map(textNode('li')));
  document.getElementById('r-advice').textContent = r.授信建议;
  const detail = document.getElementById('r-detail');
  detail.replaceChildren(...r.规则明细.map(item => {
    const row = document.createElement('div');
    row.className = 'dim-row';
    const label = document.createElement('span');
    label.textContent = `${item.维度} · ${item.说明}`;
    const value = document.createElement('span');
    value.textContent = `${item.得分}/${item.满分}`;
    row.append(label, value);
    return row;
  }));
  document.getElementById('r-engine').textContent = `评估引擎：${r.引擎}　|　规则基础分：${r.规则基础分}`;
  card.scrollIntoView({behavior:'smooth', block:'start'});
}

let warningPromise;
let warningItems = [];
let warningRisk = '';
async function loadWarnings() {
  const list = document.getElementById('warning-list');
  list.innerHTML = '<div class="loading">加载中…</div>';
  try {
    warningPromise ||= fetch('./data/enterprises.json?v=20261019-1', {cache:'no-store'}).then(response => {
      if (!response.ok) throw new Error('数据加载失败');
      return response.json();
    });
    const items = await warningPromise;
    const order = {高:0, 中:1, 低:2};
    items.sort((a, b) => (order[a['标注信用等级']] ?? 3) - (order[b['标注信用等级']] ?? 3));
    const counts = {高:0, 中:0, 低:0};
    items.forEach(item => counts[item['标注信用等级']]++);
    document.getElementById('stat-row').innerHTML = `
      <div class="stat high"><div class="n">${counts.高}</div><div class="t">高风险</div></div>
      <div class="stat mid"><div class="n">${counts.中}</div><div class="t">中风险</div></div>
      <div class="stat low"><div class="n">${counts.低}</div><div class="t">低风险</div></div>`;
    warningItems = items;
    renderWarnings();
  } catch (error) {
    list.innerHTML = '<div class="loading">预警数据暂时无法加载，请稍后重试。</div>';
  }
}

function filterWarnings(items, query, risk) {
  const keyword = query.trim().toLowerCase();
  return items.filter(item => {
    if (risk && item['标注信用等级'] !== risk) return false;
    if (!keyword) return true;
    return ['企业名称', '所属行业', '行业细分', '风险描述', '纳税状态']
      .some(field => String(item[field] || '').toLowerCase().includes(keyword));
  });
}

function renderWarnings() {
  const filtered = filterWarnings(warningItems, val('warning-search'), warningRisk);
  const list = document.getElementById('warning-list');
  list.replaceChildren(...(filtered.length
    ? filtered.map(warningCard)
    : [line('loading', '没有找到符合条件的企业。')]));
  document.getElementById('warning-result-count').textContent = `显示 ${filtered.length} / ${warningItems.length} 家企业`;
}

document.getElementById('warning-search').addEventListener('input', renderWarnings);
document.querySelectorAll('.risk-filters button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.risk-filters button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    warningRisk = button.dataset.risk;
    renderWarnings();
  });
});

console.assert(filterWarnings([{'企业名称':'示例企业','标注信用等级':'高'}], '示例', '高').length === 1, '风险筛选自检失败');

function warningCard(item) {
  const cls = {高:'high', 中:'mid', 低:'low'}[item['标注信用等级']] || 'low';
  const card = document.createElement('div');
  card.className = `warn-item ${cls}`;
  const head = document.createElement('div');
  head.className = 'warn-head';
  const name = document.createElement('div');
  name.className = 'warn-name';
  name.textContent = item['企业名称'];
  const badge = document.createElement('div');
  badge.className = `warn-badge ${cls}`;
  badge.textContent = `${item['标注信用等级']}风险`;
  head.append(name, badge);
  card.append(
    head,
    line('warn-meta', `${item['所属行业']}${item['行业细分'] ? ` · ${item['行业细分']}` : ''} · 成立${item['成立年限']}年 · 参保${item['社保人数']}人`),
    line('warn-meta', `营收${item['近12月营收(万元)']}万 · 涉诉${item['司法涉诉数']}起 · 处罚${item['行政处罚数']}次 · 异常${item['经营异常数']}次 · 纳税${item['纳税状态']}`),
    line('warn-desc', item['风险描述'] === '无' ? '经营状况稳定，无涉诉及行政处罚记录' : item['风险描述'])
  );
  return card;
}

let policyPromise;
const stopPhrases = ['介绍一下','有什么','是什么','有哪些','怎么样','怎么','怎样','如何','哪些','哪个','什么','是否','能否','请问','一下','告诉我','可以吗','吗','呢','吧','的','了'];
const policySynonyms = {
  '小微':['小微企业','小型微型企业','小型企业','微型企业'],
  '风险分类':['风险分类','金融资产风险分类','五级分类','正常类','关注类','次级类','可疑类','损失类','不良资产'],
  '划型':['划型标准','中小企业划型标准','从业人员','营业收入','资产总额'],
  '融资':['融资','融资难','融资贵','信贷'],
  '担保':['融资担保','政策性融资担保','风险补偿'],
  '个人金融信息':['个人信息','敏感个人信息','个人信息处理'],
  '个人信息':['个人信息','敏感个人信息','个人信息处理'],
  '征信':['征信机构','信用报告','信用信息'],
  '补贴':['补贴','补助','专项资金','扶持','奖励','贴息'],
  '失信':['失信被执行人','失信名单','限制高消费'],
  '异常':['经营异常','经营异常名录','异常名录'],
  '年报':['年度报告','年报','公示']
};

function loadPolicies() {
  policyPromise ||= fetch('./data/policies.json?v=20261019-2', {cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error(`政策知识库加载失败：${response.status}`);
    return response.json();
  });
  return policyPromise;
}

function cleanQuestion(question) {
  let result = question.replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, ' ');
  [...stopPhrases].sort((a, b) => b.length - a.length).forEach(word => { result = result.replaceAll(word, ' '); });
  return result.replace(/\s+/g, ' ').trim();
}

function searchPolicies(data, question, topK = 3) {
  const cleaned = cleanQuestion(question);
  if (!cleaned) return [];
  const joined = cleaned.replaceAll(' ', '');
  const phrases = new Set();
  (joined.match(/[\u4e00-\u9fff]{2,}/g) || []).forEach(part => {
    for (let size = Math.min(6, part.length); size >= 2; size -= 1) {
      for (let i = 0; i <= part.length - size; i += 1) phrases.add(part.slice(i, i + size));
    }
  });
  const synonyms = Object.entries(policySynonyms)
    .filter(([key]) => joined.includes(key))
    .flatMap(([, terms]) => terms);
  const bigrams = [...new Set((joined.match(/[\u4e00-\u9fff]+/g) || [])
    .flatMap(part => [...part].slice(0, -1).map((char, i) => char + part[i + 1])))];

  const scored = data.chunks.map(chunk => {
    let longest = 0;
    phrases.forEach(phrase => { if (chunk.text.includes(phrase)) longest = Math.max(longest, phrase.length); });
    const phraseScore = longest >= 6 ? 1 : longest === 5 ? .85 : longest === 4 ? .7 : longest === 3 ? .35 : longest === 2 ? .12 : 0;
    const synonymScore = synonyms.length ? Math.min(1, synonyms.filter(term => chunk.text.includes(term)).length / 2) : 0;
    const tokenScore = bigrams.length ? bigrams.filter(token => chunk.text.includes(token)).length / bigrams.length : 0;
    const titleTerms = [...phrases, ...synonyms].filter(term => term.length >= 2 && chunk.source.includes(term));
    const titleScore = titleTerms.length ? Math.min(1, Math.max(...titleTerms.map(term => term.length)) / 6) : 0;
    return {...chunk, score: .45 * Math.max(phraseScore, synonymScore) + .30 * tokenScore + .25 * titleScore};
  }).filter(hit => hit.score >= .12).sort((a, b) => b.score - a.score);

  const perSource = new Map();
  return scored.filter(hit => {
    const count = perSource.get(hit.source) || 0;
    if (count >= 2) return false;
    perSource.set(hit.source, count + 1);
    return true;
  }).slice(0, topK);
}

async function policyAnswer(question) {
  const data = await loadPolicies();
  const hits = searchPolicies(data, question);
  if (!hits.length) return {answer:'知识库中暂未找到明确依据。你可以换用更具体的政策关键词重新提问。', hits:[]};
  const excerpts = hits.slice(0, 2).map((hit, index) => `【原文 ${index + 1}】${hit.text}`);
  return {answer:`以下为知识库检索到的相关政策原文（公开版不调用大模型）：\n\n${excerpts.join('\n\n')}`, hits};
}

loadPolicies().then(data => {
  const stats = data.stats;
  document.getElementById('kb-text').textContent = `政策知识库已就绪：${stats.documents} 份文件 · ${stats.chunks} 个段落 · 约 ${(stats.characters / 10000).toFixed(1)} 万字`;
}).catch(() => {
  document.getElementById('kb-text').textContent = '政策知识库加载失败，请刷新页面重试';
});

const chatBox = document.getElementById('chat-box');
function pushMsg(box, text, who) {
  const node = document.createElement('div');
  node.className = `msg ${who}`;
  node.textContent = text;
  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
  return node;
}

function pushSources(box, hits) {
  if (!hits.length) return;
  const sources = [...new Set(hits.map(hit => `《${hit.source}》`))];
  const node = document.createElement('div');
  node.className = 'msg-src';
  node.textContent = `检索依据：${sources.join('、')}\n命中 ${hits.length} 个段落 · 最高匹配度 ${(hits[0].score * 100).toFixed(1)}%`;
  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
}

async function ask(question) {
  if (!question.trim()) return;
  pushMsg(chatBox, question, 'user');
  document.getElementById('qa-input').value = '';
  const holder = pushMsg(chatBox, '正在检索政策原文…', 'ai');
  try {
    const result = await policyAnswer(question);
    holder.textContent = result.answer;
    pushSources(chatBox, result.hits);
  } catch (error) {
    holder.textContent = '政策知识库暂时无法加载，请刷新页面后重试。';
  }
}
document.getElementById('btn-qa').addEventListener('click', () => ask(val('qa-input')));
document.getElementById('qa-input').addEventListener('keydown', event => {
  if (event.key === 'Enter') ask(val('qa-input'));
});
document.querySelectorAll('.tag').forEach(tag => tag.addEventListener('click', () => ask(tag.dataset.q)));

const fabPanel = document.getElementById('ai-panel');
const fabBox = document.getElementById('fab-chat-box');
document.getElementById('ai-fab').addEventListener('click', () => fabPanel.classList.toggle('open'));
document.getElementById('ai-close').addEventListener('click', () => fabPanel.classList.remove('open'));
async function fabAsk(question) {
  if (!question.trim()) return;
  pushMsg(fabBox, question, 'user');
  document.getElementById('fab-input').value = '';
  const holder = pushMsg(fabBox, '正在检索政策原文…', 'ai');
  try {
    const result = await policyAnswer(question);
    holder.textContent = result.answer;
    pushSources(fabBox, result.hits);
  } catch (error) {
    holder.textContent = '政策知识库暂时无法加载，请刷新页面后重试。';
  }
}
document.getElementById('fab-send').addEventListener('click', () => fabAsk(val('fab-input')));
document.getElementById('fab-input').addEventListener('keydown', event => {
  if (event.key === 'Enter') fabAsk(val('fab-input'));
});

console.assert(searchPolicies({chunks:[{source:'中小企业划型标准规定', text:'中小企业划型标准依据从业人员、营业收入、资产总额等指标制定。'}]}, '中小企业怎么划型').length === 1, '政策检索自检失败');

function textNode(tag) {
  return text => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };
}
function line(className, text) {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}
function val(id) { return document.getElementById(id).value.trim(); }
function num(id) { return Math.max(0, Number(document.getElementById(id).value) || 0); }
