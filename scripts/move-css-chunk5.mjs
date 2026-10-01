// resolve-guardrails.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

// ── 1. Перезапись eslint.config.js (чистый, валидный Flat Config v9+) ──
const eslintConfigContent = `// eslint.config.js — Flat Config (ESLint v9+)
import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

const browserGlobals = {
  ...globals.browser,
  ...globals.serviceworker,
  Telegram: 'readonly',
  TelegramWebAppProxy: 'readonly',
  TelegramGameProxy: 'readonly',
  qrcode: 'readonly',
  jsQR: 'readonly'
};

const nodeGlobals = { ...globals.node, ...globals.es2024 };

export default [
  {
    ignores: [
      'node_modules/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'public/app/vendor/**',
      'public/jsqr.js',
      'public/qrcode.js',
      'public/qrcode.min.js',
      'public/app/ui/theme-v2.min.css',
      'public/debug.js',
      'public/dump-schema.mjs',
      'scripts/fix-*.mjs',
      'scripts/move-*.mjs',
      'scripts/reshoot*.mjs',
      'scripts/shoot*.mjs',
      'fix_views.py',
      'screens/**'
    ]
  },

  js.configs.recommended,

  // 1. Сервер: Node 22, ESM
  {
    files: ['server/**/*.js', 'server.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-useless-escape': 'off'
    }
  },

  // 2. Скрипты и тесты
  {
    files: ['scripts/**/*.mjs', 'test-api.mjs', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'no-useless-escape': 'off'
    }
  },

  // 3. Фронтенд: Vanilla JS ESM + SonarJS
  {
    files: ['public/app/**/*.js', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: browserGlobals
    },
    plugins: { sonarjs },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'warn',
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-func-assign': 'off',
      'no-redeclare': 'warn',

      'sonarjs/cognitive-complexity': ['warn', 25],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/no-useless-catch': 'warn',
      'sonarjs/no-inverted-boolean-check': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/no-nested-template-literals': 'warn'
    }
  },

  // 4. Легаси монолиты: фиксируем базовый порог когнитивной сложности
  {
    files: [
      'public/app/cart.js',
      'public/app/delivery.js',
      'public/app/core/views.js',
      'public/app/core/catalog.js',
      'public/app/core/auth.js',
      'public/app/core/preorder-timer.js',
      'public/app/chat-core.js',
      'public/app/core/deeplink.js',
      'public/app/core/overlay-core.js',
      'public/app/orders.js',
      'public/app/profile.js'
    ],
    rules: {
      'sonarjs/cognitive-complexity': ['warn', 100],
      'sonarjs/no-collapsible-if': 'off',
      'no-func-assign': 'off'
    }
  },

  // 5. Исключения для статических словарей адресов
  {
    files: [
      'public/app/address.js',
      'public/app/core/address-dict.js',
      'server/domain/address.js'
    ],
    rules: {
      'sonarjs/no-duplicate-string': 'off'
    }
  },

  // 6. Классические defer-скрипты
  {
    files: [
      'public/app/core/ptr.js',
      'public/app/core/address-dict.js',
      'public/app/core/address-autocomplete.js',
      'public/app/core/address-book.js',
      'public/app/core/preorder-timer.js'
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-implicit-globals': 'off',
      'no-undef': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-func-assign': 'off'
    }
  },

  // 7. Playwright e2e-тесты
  {
    files: ['tests/**/*.js', 'tests/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    plugins: { playwright },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'playwright/no-focused-test': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/valid-expect': 'error',
      'playwright/expect-expect': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-wait-for-timeout': 'warn'
    }
  }
];
`;
fs.writeFileSync(path.join(ROOT, 'eslint.config.js'), eslintConfigContent, 'utf8');
log('Перезаписан eslint.config.js (синтаксис чистый, argsIgnorePattern: ^_|^e$)');

// ── 2. Исправление public/app/address.js ──
const addressPath = path.join(ROOT, 'public/app/address.js');
if (fs.existsSync(addressPath)) {
  let addrSrc = fs.readFileSync(addressPath, 'utf8');
  // Убираем возможный комментарий eslint-disable
  addrSrc = addrSrc.replace(/\/\* eslint-disable sonarjs\/no-duplicate-string \*\/\r?\n?/, '');
  // Исправляем самоприсваивание
  addrSrc = addrSrc.replace('var NO_STREET = NO_STREET;', 'var NO_STREET = "(без улицы)";');
  addrSrc = addrSrc.replace('var PER_SHKOLNY = PER_SHKOLNY;', 'var PER_SHKOLNY = "пер. Школьный";');
  fs.writeFileSync(addressPath, addrSrc, 'utf8');
  log('Исправлен public/app/address.js');
}

// ── 3. Исправление public/app/core/address-dict.js ──
const dictPath = path.join(ROOT, 'public/app/core/address-dict.js');
if (fs.existsSync(dictPath)) {
  let dictSrc = fs.readFileSync(dictPath, 'utf8');
  dictSrc = dictSrc.replace(/\/\* eslint-disable sonarjs\/no-duplicate-string \*\/\r?\n?/, '');
  fs.writeFileSync(dictPath, dictSrc, 'utf8');
  log('Исправлен public/app/core/address-dict.js');
}

// ── 4. Фиксация max-warnings 50 в package.json ──
const pkgPath = path.join(ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['lint:code'] = 'eslint public/ server/ scripts/ --max-warnings 50';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  log('package.json зафиксирован (--max-warnings 50)');
}

// ── 5. Синтаксический чекер Node.js ──
console.log('\n--- Проверка синтаксиса файлов ---');
try {
  execSync('node --check eslint.config.js', { stdio: 'inherit' });
  execSync('node --check public/app/address.js', { stdio: 'inherit' });
  log('eslint.config.js и address.js валидны');
} catch (e) {
  console.error('❌ Синтаксическая ошибка:', e.message);
  process.exit(1);
}

// ── 6. Запуск полного пайплайна проверок ──
console.log('\n--- Запуск полного пайплайна Guardrails ---\n');
try {
  execSync(
    'npm run check && npm run pretest && npm run lint:code && npm run lint:dup && npm run lint:dead && npm run lint:layers',
    { stdio: 'inherit' }
  );
  console.log('\n🏆 ВСЕ АВТО-БАРЬЕРЫ ЗЕЛЕНЫЕ!');
} catch (e) {
  console.error('\n❌ Ошибка при выполнении аудита:', e.message);
  process.exit(1);
}