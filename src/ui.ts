import { DEFAULT_BINDINGS, ENEMIES, LEVELS, PERKS, REGIONS, SKILLS, WEAPONS } from './data';
import type { Game, Screen } from './game';
import { arrow, icon, pauseIcon } from './icons';
import { writeSave } from './storage';
import type { Settings, SkillId, WeaponId } from './types';

const htmlEscape = (v: string) => v.replace(/[&<>"']/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[t]!);
const keyName = (code: string) => code.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('Space', '空格').replace('Escape', 'Esc');
const timeText = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

/** DOM 层管理界面与语义按钮；没有任何按钮直接操纵敌人的生命值或通关条件。 */
export class UI {
  private overlay = document.querySelector<HTMLElement>('#overlay')!;
  private hud = document.querySelector<HTMLElement>('#hud')!;
  private touch = document.querySelector<HTMLElement>('#touch')!;
  private notice = document.querySelector<HTMLElement>('#notice')!;
  private noticeTimer = 0;
  constructor(private game: Game) {
    game.onChange = () => this.render(); game.onHud = () => this.renderHud(); game.onNotice = text => this.toast(text);
    document.querySelector('#app')!.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (button && !(button as HTMLButtonElement).disabled) this.action(button.dataset.action!, button);
    });
    this.overlay.addEventListener('input', e => this.setting(e));
    this.touch.innerHTML = `<div class="touch-move"><div class="joystick" data-stick role="group" aria-label="移动摇杆"><svg class="joystick-directions" viewBox="0 0 132 132" aria-hidden="true"><path d="M60 19l6-6 6 6M60 113l6 6 6-6M19 60l-6 6 6 6M113 60l6 6-6 6"/></svg><div class="joystick-thumb" data-stick-thumb><span></span></div></div><span class="joystick-label">移动 / 方向</span></div><div class="touch-aux"><button data-touch="block">格挡</button><button data-touch="skill">技能</button><button data-touch="interact">拾取</button><button data-touch="throw">投掷</button></div><div class="touch-fight"><button data-touch="dodge">闪避</button><button data-touch="jump">跳跃</button><button data-touch="heavy">重击</button><button data-touch="light">轻击</button></div>`;
    game.input.attachTouch(this.touch); this.render(); this.renderHud(); this.applySettings();
  }
  toast(text: string) { this.notice.textContent = text; this.notice.classList.add('visible'); clearTimeout(this.noticeTimer); this.noticeTimer = window.setTimeout(() => this.notice.classList.remove('visible'), 3300); }
  private button(label: string, action: string, primary = false, extra = '') { return `<button class="button ${primary ? 'primary' : ''}" data-action="${action}" ${extra}>${label}${arrow}</button>`; }
  private frame(title: string, subtitle: string, content: string, foot = '', wide = false) {
    return `<section class="panel ${wide ? 'wide' : ''}"><header class="panel-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><span class="seal">墨</span></header><div class="panel-content">${content}</div>${foot ? `<footer class="panel-footer">${foot}</footer>` : ''}</section>`;
  }
  render() {
    const g = this.game, p = g.player, s = g.screen;
    document.querySelector('#app')!.setAttribute('data-screen', s);
    document.querySelector('#app')!.setAttribute('data-mode', g.world.mode);
    this.touch.classList.toggle('active', s === 'playing'); this.overlay.className = s === 'menu' ? 'menu-overlay' : s === 'playing' ? 'hidden' : 'screen-overlay';
    if (s === 'playing') { this.overlay.innerHTML = ''; this.renderHud(); return; }
    if (s === 'menu') {
      this.overlay.innerHTML = `<div class="menu-top"><span class="wordmark"><i></i> INKSHADOW</span><span class="edition">单人横版动作 / 本地存档</span></div><section class="main-menu"><h1 class="game-title"><span>墨影</span><span>激斗<em>。</em></span></h1><p class="tagline">以拳破局，以影为名。</p><div class="menu-actions">${this.button(g.save.checkpoint ? '继续战役' : '开始战役', g.save.checkpoint ? 'continue' : 'campaign', true)}<div class="menu-second"><button data-action="arena">竞技场挑战 ${arrow}</button><button data-action="training">训练场 ${arrow}</button></div><div class="menu-small"><button data-action="chapters">章节选择</button><button data-action="settings">设置</button><button data-action="controls">操作说明</button>${g.save.checkpoint ? '<button data-action="campaign">重新开始</button>' : ''}</div></div></section><div class="menu-scene"><span class="scene-line"></span><div><strong>黄昏旧街</strong><span>第一站 · 城市边缘</span></div></div><footer class="menu-footer"><span><kbd>A</kbd><kbd>D</kbd> 移动 <kbd>J</kbd> 出拳 <kbd>SPACE</kbd> 跳跃</span><span>六关战役 · 拾取武器 · 追击至空中</span><span>v1.0</span></footer>`;
    } else if (s === 'pause') {
      this.overlay.innerHTML = this.frame('暂歇片刻', '调整呼吸，下一击仍由你掌握。', `<div class="pause-stats"><span>${g.world.mode === 'campaign' ? LEVELS[g.world.level].name : g.world.mode === 'arena' ? `竞技场 · 第 ${g.world.wave} 波` : '训练场'}</span><strong>${timeText(g.totalTime)}</strong></div><div class="vertical-actions">${this.button('继续战斗', 'resume', true)}${this.button('装备与构筑', 'equipment')}${this.button('操作说明', 'controls')}${this.button('设置', 'settings')}${this.button('从安全起点重试', 'retry')}${this.button('返回主菜单', 'menu')}</div>`, '所有动作、机关与计时均已暂停。');
    } else if (s === 'tutorial' || s === 'controls') {
      const bind = g.save.settings.bindings;
      const rows = [['移动', `${keyName(bind.left)} / ${keyName(bind.right)} 或 ← / →`], ['跳跃 / 下落', `${keyName(bind.jump)} / ${keyName(bind.down)}＋${keyName(bind.jump)}`], ['四段轻击', `${keyName(bind.light)} 连续按下`], ['重击 / 上挑', `${keyName(bind.heavy)} / ${keyName(bind.up)}＋${keyName(bind.heavy)}`], ['空连 / 下砸', `空中 ${keyName(bind.light)} / ${keyName(bind.down)}＋${keyName(bind.heavy)}`], ['闪避 / 格挡', `${keyName(bind.dodge)} / 按住 ${keyName(bind.block)}`], ['拾取 / 投掷', `${keyName(bind.interact)} / ${keyName(bind.throw)}`], ['主动技能 / 暂停', `${keyName(bind.skill)} / ${keyName(bind.pause)}`]];
      this.overlay.innerHTML = this.frame(s === 'tutorial' ? '第一课，出招。' : '招式手册', '简单输入，打出自己的连招。', `<div class="controls-grid"><div class="control-list">${rows.map(([name, keys]) => `<div><span>${name}</span><strong>${keys}</strong></div>`).join('')}</div><div class="combat-guide">${icon('fist', '#e8bd8c', 88)}<h2>轻击 → 上挑 → 跳跃追击 → 下砸</h2><p>攻击到来前 0.16 秒内按下格挡，触发精准防御。面向攻击才能格挡。</p><p><b class="danger">红色三角预警</b>代表不可格挡，使用闪避或跳跃避开。金色预警可以防御。</p><p>触屏：摇杆向上推再点重击完成上挑；空中向下推摇杆再点重击完成下砸。</p></div></div>`, this.button(s === 'tutorial' ? '进入旧街' : '返回', s === 'tutorial' ? 'tutorial-done' : 'back', true), true);
    } else if (s === 'reward') {
      this.overlay.innerHTML = this.frame('让战意，生出新招。', '选择一项强化。叠加上限和效果会立即应用于当前构筑。', `<div class="reward-grid">${g.rewardList.map(perk => `<button class="reward-card" data-action="perk:${perk.id}" style="--item-color:${perk.color}"><div class="reward-art">${icon(perk.icon, perk.color, 104)}</div><span class="stack">${(p.perks[perk.id] || 0) + 1} / ${perk.max} 层</span><h2>${perk.name}</h2><p>${perk.desc}</p><span class="choose">选取强化 ${arrow}</span></button>`).join('')}</div>`, g.rewardList.length ? '战斗已暂停 · 本次奖励只能领取一次' : this.button('构筑已满，继续前进', 'reward-skip', true), true);
    } else if (s === 'shop') {
      const products = [
        { id: 'heal', name: '温热药汤', desc: '立即恢复 70 耐久。', price: 35, art: 'heart', color: '#e5a28b' },
        { id: 'repair', name: '武器修理', desc: '当前武器耐久恢复至全满。', price: 25, art: 'repair', color: '#cbb58b' },
        ...g.shopStock.map(id => ({ id: `weapon:${id}`, name: WEAPONS[id].name, desc: `${WEAPONS[id].caption} · 替换当前武器`, price: 45, art: id, color: WEAPONS[id].color })),
        ...Object.entries(SKILLS).map(([id, d]) => ({ id: `skill:${id}`, name: d.name, desc: `${d.description} 替换当前主动技能。`, price: 55, art: id, color: d.color })),
        { id: 'revive', name: '不息护身符', desc: '本局濒死时恢复 45% 耐久，最多携带一个。', price: 90, art: 'crest', color: '#d9bb7d' },
      ];
      this.overlay.innerHTML = this.frame('街角整备', `现有金币 ${g.coins} · 花一点时间，走更远的路。`, `<div class="shop-grid">${products.map(item => `<article class="shop-item">${icon(item.art, item.color, 58)}<div><h2>${item.name}</h2><p>${item.desc}</p></div><button class="buy" data-action="buy:${item.id}" ${g.shopBought.has(item.id) || g.coins < item.price ? 'disabled' : ''}>${g.shopBought.has(item.id) ? '已购买' : `${item.price} 金币`}</button></article>`).join('')}</div>`, this.button('整备完成，继续前进', 'shop-done', true), true);
    } else if (s === 'settings') this.renderSettings();
    else if (s === 'chapters') {
      this.overlay.innerHTML = this.frame('穿城而过', '已通过的章节可自由重访；继续战役会恢复当前检查点构筑。', `<div class="chapter-grid">${LEVELS.map((l, i) => { const available = i === 0 || g.save.completed.includes(i - 1) || g.save.checkpoint?.level === i; return `<button class="chapter region-${l.region}" data-action="chapter:${i}" ${available ? '' : 'disabled'}><span class="chapter-index">${String(i + 1).padStart(2, '0')}</span><span class="chapter-copy"><small>${REGIONS[l.region]}</small><strong>${l.name}</strong><span>${g.save.completed.includes(i) ? '已完成 · 再次挑战' : available ? '开始挑战' : '通过上一关后解锁'}</span></span>${arrow}</button>`; }).join('')}</div>`, this.button('返回主菜单', 'menu'), true);
    } else if (s === 'equipment') {
      this.overlay.innerHTML = this.frame('此刻的你', `${WEAPONS[p.weapon].name} · ${SKILLS[p.skill].name}`, `<div class="equipment-head"><div>${icon(p.weapon, WEAPONS[p.weapon].color, 90)}<h2>${WEAPONS[p.weapon].name}</h2><p>${WEAPONS[p.weapon].caption}</p></div><div>${icon(p.skill, SKILLS[p.skill].color, 90)}<h2>${SKILLS[p.skill].name}</h2><p>${SKILLS[p.skill].description}</p></div></div><h2 class="subhead">已获得的强化</h2><div class="perk-list">${Object.entries(p.perks).length ? Object.entries(p.perks).map(([id, count]) => { const perk = PERKS.find(x => x.id === id); return perk ? `<div>${icon(perk.icon, perk.color, 42)}<span><strong>${perk.name} ×${count}</strong><small>${perk.desc}</small></span></div>` : ''; }).join('') : '<p class="empty">尚未获得强化，完成战斗后可三选一。</p>'}</div>`, this.button('回到暂停菜单', 'pause'), true);
    } else if (s === 'result') {
      this.overlay.innerHTML = this.frame(g.resultTitle, g.resultReason, `<div class="result-emblem">${icon(g.resultWin ? 'crest' : 'fist', g.resultWin ? '#e5c78b' : '#bc9f8d', 130)}</div><div class="result-stats"><div><strong>${g.kills}</strong><span>击败对手</span></div><div><strong>${g.bestCombo}</strong><span>最高连击</span></div><div><strong>${timeText(g.totalTime)}</strong><span>本次用时</span></div><div><strong>${g.score.toLocaleString()}</strong><span>战斗得分</span></div></div><div class="result-actions">${this.button(g.resultWin ? '挑战竞技场' : '再次挑战', g.resultWin ? 'arena' : 'retry', true)}${this.button('返回主菜单', 'menu')}</div>`, g.world.mode === 'arena' ? `竞技场纪录：${g.save.bestWave} 波 / ${g.save.bestScore.toLocaleString()} 分` : g.resultWin ? '最终首领已击败 · 战役完成记录已保存' : '本地安全检查点已保留');
    }
    if (s === 'settings') this.overlay.querySelector('.sliders')!.insertAdjacentHTML('beforeend', `<div class="touch-setting"><span>触控按钮显示</span><button data-action="toggle-touch">${g.save.settings.showTouch ? '始终显示' : '自动识别触屏'}</button></div>`);
    this.renderHud(); this.applySettings();
  }
  renderHud() {
    const g = this.game, p = g.player, w = g.world;
    const skillButton = this.touch.querySelector<HTMLButtonElement>('[data-touch="skill"]');
    if (skillButton) {
      const skill = SKILLS[p.skill], cooling = p.skillCooldown > 0;
      skillButton.classList.add('touch-skill'); skillButton.classList.toggle('on-cooldown', cooling);
      skillButton.classList.toggle('energy-low', p.energy < skill.cost);
      skillButton.setAttribute('aria-label', `${skill.name}${cooling ? `，冷却 ${Math.ceil(p.skillCooldown)} 秒` : `，消耗 ${skill.cost} 能量`}`);
      skillButton.innerHTML = `${icon(p.skill, cooling || p.energy < skill.cost ? '#93a5a5' : skill.color, 30)}<span class="touch-skill-name">${skill.name}</span>${cooling ? `<em class="touch-skill-timer">${Math.ceil(p.skillCooldown)}</em>` : `<span class="touch-skill-cost">${skill.cost}</span>`}`;
    }
    this.hud.classList.toggle('hidden', g.screen === 'menu' || g.screen === 'chapters' || g.screen === 'result' || (['settings', 'controls'].includes(g.screen) && g.previousScreen === 'menu'));
    if (g.screen === 'menu') return;
    const boss = w.enemies.find(e => e.boss && e.hp > 0);
    this.hud.innerHTML = `<div class="hud-top"><div class="vitals"><div class="player-name"><span class="player-mark">影</span><strong>无名斗士</strong><small>${Math.ceil(p.hp)} / ${p.maxHp}</small>${p.shield > 0 ? `<small class="shield-text">护盾 ${Math.ceil(p.shield)}</small>` : ''}</div><div class="health-track"><i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div><div class="energy-track"><i style="width:${p.energy}%"></i></div></div><div class="stage-objective"><strong>${w.mode === 'campaign' ? LEVELS[w.level].name : w.mode === 'arena' ? '无尽竞技场' : '训练场'}</strong><span>${g.objective()}</span></div><div class="hud-tools"><span class="coins">${icon('coin', '#d5b577', 25)} ${g.coins}</span><button data-action="pause" aria-label="暂停游戏">${pauseIcon}</button></div></div>${boss ? `<div class="boss-vitals"><div><span>${ENEMIES[boss.type].name}</span><small>阶段 ${boss.phase} · 红色预警不可格挡</small></div><div class="boss-track"><i style="width:${boss.hp / boss.maxHp * 100}%"></i></div></div>` : ''}<div class="loadout"><div class="weapon-hud">${icon(p.weapon, WEAPONS[p.weapon].color, 43)}<div><strong>${WEAPONS[p.weapon].name}</strong><small>${p.weapon === 'fist' ? '拳脚自成兵器' : w.mode === 'training' ? '训练耐久无限' : `耐久 ${p.durability} / ${WEAPONS[p.weapon].durability}`}</small></div><kbd>E / Q</kbd></div><div class="skill-hud ${p.skillCooldown > 0 ? 'cooling' : ''}">${icon(p.skill, SKILLS[p.skill].color, 38)}<div><strong>${SKILLS[p.skill].name}</strong><small>${p.skillCooldown > 0 ? `冷却 ${p.skillCooldown.toFixed(1)}s` : `就绪 · ${SKILLS[p.skill].cost} 能量`}</small></div><kbd>U</kbd></div></div>${g.combo > 1 ? `<div class="combo-count"><strong>${g.combo}</strong><span>连击</span><small>${g.combo >= 20 ? '势不可挡' : g.combo >= 10 ? '行云流水' : '保持节奏'}</small></div>` : ''}<div class="bottom-hint">${w.mode === 'campaign' ? `${REGIONS[w.region]} / ${String(w.level + 1).padStart(2, '0')}　${timeText(g.totalTime)}` : w.mode === 'arena' ? `最高纪录 ${g.save.bestWave} 波 · ${g.save.bestScore} 分` : '上＋重击 上挑 / 空中下＋重击 下砸'}</div>${w.mode === 'training' ? `<div class="training-tools"><div class="training-readout"><strong>${g.trainingDamage}</strong> 总伤害 <strong>${g.trainingHits}</strong> 命中 <strong>${g.combo}</strong> 连击</div><div class="training-weapons">${Object.entries(WEAPONS).map(([id, d]) => `<button data-action="train:${id}" class="${p.weapon === id ? 'selected' : ''}">${d.name.replace('街巷', '').replace('游龙', '').replace('铸铁', '').replace('双影', '').replace('回旋', '')}</button>`).join('')}</div><div class="training-skills">${Object.entries(SKILLS).map(([id,d]) => `<button data-action="train-skill:${id}" class="${p.skill === id ? 'selected' : ''}">${icon(id,d.color,18)} ${d.name}</button>`).join('')}</div><button data-action="train-ai">${g.trainingAttack ? '暂停陪练进攻' : '开启陪练进攻'}</button><button data-action="train-reset">重置统计</button><button data-action="menu">退出训练</button></div>` : ''}`;
  }
  private renderSettings() {
    const g = this.game, settings = g.save.settings;
    const sliders: [keyof Settings, string, string, number, number][] = [ ['music', '音乐音量', '独立控制环境节奏与旋律', 0, 1], ['sfx', '音效音量', '拳脚、武器与界面反馈', 0, 1], ['shake', '镜头震动', '命中时的镜头反馈强度', 0, 1], ['flash', '命中闪光', '角色受击高亮强度', 0, 1], ['effects', '特效强度', '火花、攻击轨迹与扬尘', 0, 1], ['touchSize', '触控按钮大小', '横屏触控布局，自动适配安全区域', .75, 1.3], ['touchOpacity', '触控按钮透明度', '在动作视野和按钮清晰度间调整', .2, 1] ];
    this.overlay.innerHTML = this.frame('按自己的节奏', '设置保存在此浏览器中，随时可以调整。', `<div class="settings-grid"><div class="sliders">${sliders.map(([key, title, desc, min, max]) => `<label class="setting-row"><span><strong>${title}</strong><small>${desc}</small></span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="0.05" value="${settings[key]}" aria-label="${title}"/><output>${Math.round(Number(settings[key]) * 100)}%</output></label>`).join('')}</div><div class="bindings"><h2>键位调整</h2><p>点击按键后，按下新的键。方向键始终可以移动。</p>${Object.entries({ left: '左移', right: '右移', up: '上方向', down: '下方向', jump: '跳跃', light: '轻击', heavy: '重击', dodge: '闪避', block: '格挡', interact: '拾取', throw: '投掷', skill: '技能', pause: '暂停' }).map(([id, name]) => `<button data-action="bind:${id}"><span>${name}</span><kbd>${keyName(settings.bindings[id])}</kbd></button>`).join('')}<button class="reset-keys" data-action="reset-keys">恢复默认键位</button></div></div>`, this.button('保存并返回', 'settings-back', true), true);
  }
  private setting(event: Event) {
    const input = event.target as HTMLInputElement, key = input.dataset.setting;
    if (!key) return;
    const settings = this.game.save.settings;
    (settings as unknown as Record<string, unknown>)[key] = Number(input.value);
    input.parentElement!.querySelector('output')!.textContent = `${Math.round(Number(input.value) * 100)}%`;
    this.game.audio.configure(settings); writeSave(this.game.save); this.applySettings();
  }
  private applySettings() {
    const settings = this.game.save.settings;
    document.querySelector('#app')!.classList.toggle('touch-enabled', settings.showTouch);
    document.documentElement.style.setProperty('--touch-size', String(settings.touchSize));
    document.documentElement.style.setProperty('--touch-opacity', String(settings.touchOpacity));
  }
  private action(action: string, button: HTMLElement) {
    const g = this.game;
    if (action.startsWith('perk:')) { g.selectPerk(action.slice(5)); return; }
    if (action.startsWith('buy:')) { g.buy(action.slice(4)); return; }
    if (action.startsWith('train:')) { g.equipTraining(action.slice(6) as WeaponId); return; }
    if (action.startsWith('train-skill:')) { g.equipTrainingSkill(action.slice(12) as SkillId); return; }
    if (action.startsWith('chapter:')) { g.start('campaign', false, Number(action.slice(8))); return; }
    if (action.startsWith('bind:')) {
      const id = action.slice(5); button.querySelector('kbd')!.textContent = '请按键';
      g.input.capture = code => {
        if (['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(code)) { this.toast('请选择普通按键，避免系统组合键冲突'); this.render(); return; }
        const other = Object.keys(g.save.settings.bindings).find(k => k !== id && g.save.settings.bindings[k] === code);
        if (other) g.save.settings.bindings[other] = g.save.settings.bindings[id];
        g.save.settings.bindings[id] = code; g.updateSettings();
      }; return;
    }
    switch (action) {
      case 'campaign': g.start('campaign'); break;
      case 'continue': g.start('campaign', true); break;
      case 'arena': g.start('arena'); break;
      case 'training': g.start('training'); break;
      case 'menu': g.menu(); break;
      case 'pause': g.setScreen('pause'); break;
      case 'resume': g.setScreen('playing'); break;
      case 'retry': g.retry(); break;
      case 'settings': g.open('settings'); break;
      case 'settings-back': g.input.capture = null; g.setScreen(g.previousScreen); break;
      case 'chapters': g.setScreen('chapters'); break;
      case 'controls': g.open('controls'); break;
      case 'equipment': g.setScreen('equipment'); break;
      case 'back': g.setScreen(g.previousScreen === 'playing' ? 'pause' : g.previousScreen); break;
      case 'tutorial-done': g.finishTutorial(); break;
      case 'reward-skip': g.afterReward(); break;
      case 'shop-done': g.leaveShop(); break;
      case 'reset-keys': g.resetBindings(); break;
      case 'toggle-touch': g.save.settings.showTouch = !g.save.settings.showTouch; g.updateSettings(); break;
      case 'train-ai': g.trainingAttack = !g.trainingAttack; this.renderHud(); break;
      case 'train-reset': g.trainingDamage = 0; g.trainingHits = 0; g.combo = 0; g.trainingStart = 0; this.renderHud(); break;
      default: this.toast(`无法识别操作：${htmlEscape(action)}`);
    }
  }
}
