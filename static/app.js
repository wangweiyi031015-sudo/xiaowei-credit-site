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

const knowledge = [
  {keys:['风险分类','五级分类','贷款分类'], answer:'小微企业贷款通常按风险程度划分为正常、关注、次级、可疑和损失五类。分类时需综合考虑还款能力、逾期情况、担保状况和经营变化，并持续动态调整。'},
  {keys:['个人信息','隐私','信息保护'], answer:'处理个人金融信息应遵循合法、正当、必要和诚信原则，明确告知处理目的、方式与范围，采取与风险相匹配的安全措施，并为查询、更正和删除提供渠道。'},
  {keys:['失信','被执行人','限制高消费'], answer:'被列为失信被执行人后，可能面临信用惩戒、限制高消费、融资受限等后果。金融机构通常会将其作为重要风险信号，并结合案件进展审慎授信。'},
  {keys:['授信','贷款条件'], answer:'授信判断通常综合经营年限、营收与现金流、纳税和社保、司法诉讼、行政处罚、经营异常及担保情况。系统结果仅用于演示和辅助研判，不能替代金融机构正式尽调。'}
];

function localAnswer(question) {
  const hit = knowledge.find(item => item.keys.some(key => question.includes(key)));
  return hit ? hit.answer : '当前公开版使用本地政策知识库。你可以询问：小微贷款风险分类、个人金融信息保护、失信被执行人或企业授信条件。';
}

const chatBox = document.getElementById('chat-box');
function pushMsg(box, text, who) {
  const node = document.createElement('div');
  node.className = `msg ${who}`;
  node.textContent = text;
  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
}
function ask(question) {
  if (!question.trim()) return;
  pushMsg(chatBox, question, 'user');
  document.getElementById('qa-input').value = '';
  pushMsg(chatBox, localAnswer(question), 'ai');
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
function fabAsk(question) {
  if (!question.trim()) return;
  pushMsg(fabBox, question, 'user');
  document.getElementById('fab-input').value = '';
  pushMsg(fabBox, localAnswer(question), 'ai');
}
document.getElementById('fab-send').addEventListener('click', () => fabAsk(val('fab-input')));
document.getElementById('fab-input').addEventListener('keydown', event => {
  if (event.key === 'Enter') fabAsk(val('fab-input'));
});

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
