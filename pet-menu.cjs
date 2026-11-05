const noop = () => {};

function buildPetMenu({ settings, asleep, actions = {}, extras = [] }) {
  const act = {
    open: actions.open || noop,
    say: actions.say || noop,
    reset: actions.reset || noop,
    hide: actions.hide || noop,
    quit: actions.quit || noop,
    toggleSleep: actions.toggleSleep || noop,
    toggle: actions.toggle || noop,
  };
  return [
    { label: '打开阅读伙伴', click: act.open },
    { label: '说句话', click: act.say },
    { type: 'separator' },
    { label: asleep ? '叫醒看山' : '睡一会儿', click: act.toggleSleep },
    {
      label: '碎碎念',
      type: 'checkbox',
      checked: !!settings.whisper,
      click: () => act.toggle('whisper'),
    },
    {
      label: '用 AI 碎碎念（会发送阅读概况）',
      type: 'checkbox',
      checked: !!settings.whisperAi,
      click: () => act.toggle('whisperAi'),
    },
    {
      label: '音效',
      type: 'checkbox',
      checked: !!settings.sound,
      click: () => act.toggle('sound'),
    },
    ...extras,
    { type: 'separator' },
    { label: '回到屏幕右下角', click: act.reset },
    { label: '暂时隐藏 10 分钟', click: act.hide },
    { type: 'separator' },
    { label: '退出看山', click: act.quit },
  ];
}

function buildTrayMenu({ settings, asleep, actions = {} }) {
  const act = {
    open: actions.open || noop,
    show: actions.show || noop,
    quit: actions.quit || noop,
    toggleSleep: actions.toggleSleep || noop,
    toggle: actions.toggle || noop,
  };
  return [
    { label: '打开阅读伙伴', click: act.open },
    { label: '显示看山', click: act.show },
    { type: 'separator' },
    { label: asleep ? '叫醒看山' : '睡一会儿', click: act.toggleSleep },
    {
      label: '碎碎念',
      type: 'checkbox',
      checked: !!settings.whisper,
      click: () => act.toggle('whisper'),
    },
    { type: 'separator' },
    { label: '退出看山', click: act.quit },
  ];
}

module.exports = { buildPetMenu, buildTrayMenu };
