// .dependency-cruiser.js
// Правила однонаправленности зависимостей. «Стрелка вверх» = нарушение.
//
// Архитектура:
//   server/  ← isolated runtime, никогда не знает про фронт
//   public/app/ui/  →  public/app/core/   (только «вниз»)
//   public/app/*.js →  public/app/core/   (модули фич поверх ядра)
//   tests/ scripts/ →  любой код, но никто не импортирует их в прод

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-server-to-frontend',
      severity: 'error',
      comment:
        'Сервер (server/) не может импортировать фронтенд-код (public/): ' +
        'это разные среды (Node.js vs браузер) — слои обязаны быть однонаправленными.',
      from: { path: '^server/' },
      to: { path: '^public/' }
    },

    {
      name: 'no-core-to-ui',
      severity: 'error',
      comment:
        'Ядро (public/app/core/) не должно импортировать UI-модули (public/app/ui/): ' +
        'UI знает про core, core про UI — нет.',
      from: { path: '^public/app/core/' },
      to: { path: '^public/app/ui/' }
    },

    {
      name: 'no-test-helpers-in-prod',
      severity: 'error',
      comment:
        'Тестовые хелперы/моки (tests/, scripts/) не должны попадать в прод-код: ' +
        'иначе прод тащит мок-данные и тест-утилиты.',
      from: { pathNot: '^(tests|scripts)/' },
      to: { path: '^(tests|scripts)/' }
    },

    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Циклические импорты ломают ESM: TDZ (Cannot access X before initialization). ' +
        'Разрывайте общий код в отдельный модуль, а не замыкайте граф.',
      from: {},
      to: { circular: true }
    },

    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Модуль не подключён ни к одному графу импортов — вероятный мёртвый код ' +
        'или забытая регистрация в main.js.',
      from: {
  orphan: true,
  pathNot: [
    '(^|/)public/sw\\.js$',
    '(^|/)public/debug\\.js$',
    // Классические скрипты из index.html:
    '(^|/)public/app/core/(ptr|address-dict|address-autocomplete|address-book|preorder-timer)\\.js$',
    // Динамически подгружаемые в рантайме (scanner.js → loadJsqr):
    '(^|/)public/jsqr\\.js$',
    '(^|/)public/qrcode\\.js$',
    // Пустой placeholder / известный orphan — разберём отдельно:
    '(^|/)public/app/ui/dropdowns\\.js$',
    '(^|/)public/app/core/overlay\\.js$',
    '\\.d\\.ts$'
  ]
}
,
      to: {}
    }
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: 'node_modules|\\.min\\.js$|^public/app/vendor/'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'browser']
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
      archi: { collapsePattern: '^(node_modules|public|server|scripts|tests)/[^/]+' },
      text: { highlightFocused: true }
    }
  }
};
