#!/usr/bin/env bash
# Применение правок «бонусы + карточки меню» к вашему репозиторию.
#
#   bash apply.sh          # dry-run: что применилось бы, что нет (ничего не меняет)
#   bash apply.sh --apply  # применить (бэкапы оригиналов → <kit>/backup/)
#
# Скрипту всё равно, где он лежит: корень репозитория и каталог с патчами он находит сам.
# Порядок: точечные вставки (index.html / schema.js / auth.js) → патчи по файлам → удаление дубля.
# Каждый файл обрабатывается независимо: отказ одного не откатывает остальные (в отличие от git am).
# Если патч не лёг, файл помечен FAILED — его конечное содержимое лежит в <kit>/files/<путь>.
set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

# ── Корень репозитория: ищем вверх от каталога скрипта, затем от текущей папки ──
find_root() {
  local d="$1"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    if [ -f "$d/package.json" ] && [ -d "$d/server" ] && [ -d "$d/public" ]; then echo "$d"; return 0; fi
    d="$(dirname "$d")"
  done
  return 1
}
ROOT="$(find_root "$SELF_DIR")" || ROOT="$(find_root "$PWD")" || ROOT=""
if [ -z "$ROOT" ]; then
  echo "❌ Не нашёл корень репозитория (нужны package.json + server/ + public/)."
  echo "   Положите apply.sh внутрь репозитория и запустите снова."
  exit 1
fi
cd "$ROOT" || exit 1
echo "Репозиторий: $ROOT"

# ── Каталог комплекта: apply/ рядом со скриптом, в корне репо, или патчи россыпью ──
KIT=""; LOOSE=0
for cand in "$SELF_DIR" "$SELF_DIR/apply" "$ROOT/apply"; do
  if [ -d "$cand/patches" ]; then KIT="$cand"; break; fi
done
if [ -z "$KIT" ] && ls "$SELF_DIR"/*.patch >/dev/null 2>&1; then KIT="$SELF_DIR"; LOOSE=1; fi
if [ -z "$KIT" ]; then
  echo "❌ Не нашёл патчи. Ожидается каталог patches/ рядом с apply.sh (или *.patch прямо рядом)."
  exit 1
fi
echo "Комплект:    $KIT$([ "$LOOSE" = 1 ] && echo '  (патчи россыпью)')"
echo

patch_path() {
  if [ "$LOOSE" = 1 ]; then echo "$KIT/$(echo "$1" | sed 's|/|__|g').patch"
  else echo "$KIT/patches/$(echo "$1" | sed 's|/|__|g').patch"; fi
}
ref_file() {
  for cand in "$KIT/files/$1" "$SELF_DIR/files/$1" "$ROOT/apply/files/$1"; do
    [ -f "$cand" ] && { echo "$cand"; return 0; }
  done
  echo ""
}
BACKUP="$KIT/backup"

if [ -z "$(command -v node)" ]; then echo "❌ node не найден в PATH (нужен Node 22)"; exit 1; fi
node -v | grep -q "^v22" || echo "⚠️  node $(node -v): проект рассчитан на Node 22 (better-sqlite3 на 20 может сегфолтить)"

FILES=(
  knip.json
  public/app/core/views.js
  public/app/ui/theme/160-09-preorder-subfilters.css
  public/app/ui/theme/20-cards.css
  server/db/schema.js
  server/domain/bonuses.js
  server/domain/loyalty.js
  server/routes/auth.js
  server/utils/loyalty-helpers.js
  tests/menu-cards.spec.js
  tests/pwa-responsive.spec.js
  tests/unit/bonus-grants.test.mjs
)

ok=(); done_already=(); fuzzy=(); failed=(); manual=()

# ── Шаг 1. Точечные вставки (устойчивы к дрейфу файлов) ──
echo "════ Шаг 1. Точечные вставки (устойчивы к дрейфу файлов) ════"
INSERT_RC=0
INSERTERS=""
for cand in "$KIT/inserters.mjs" "$SELF_DIR/inserters.mjs" "$ROOT/apply/inserters.mjs"; do
  [ -f "$cand" ] && { INSERTERS="$cand"; break; }
done
if [ -n "$INSERTERS" ]; then
  if [ "$APPLY" = "1" ]; then
    mkdir -p "$BACKUP"
    for f in public/index.html server/db/schema.js server/routes/auth.js; do
      [ -f "$f" ] && { mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"; }
    done
    echo "(бэкапы: $BACKUP/)"
    node "$INSERTERS" --apply; INSERT_RC=$?
  else
    node "$INSERTERS"; INSERT_RC=$?
  fi
else
  # Без inserters.mjs schema.js и auth.js всё равно правятся патчами (шаг 2).
  # Не покрыт патчем только public/index.html — его правило печатаем для ручной вставки.
  echo "⚠️  inserters.mjs не найден — пропускаю вставки."
  echo "   schema.js и auth.js будут поправлены патчами в шаге 2."
  if ! grep -q "contain-intrinsic-block-size" public/index.html 2>/dev/null; then
    echo "   В public/index.html нужно вручную добавить правило (в блок <style> с content-visibility):"
    ref=$(ref_file public/index.html)
    if [ -n "$ref" ]; then
      echo "   --- начало фрагмента ---"
      awk '/Резерв высоты для карточек меню вне экрана/,/^\}$/' "$ref" | sed 's/^/   /'
      echo "   --- конец фрагмента ---"
    else
      echo "     #grid .card:nth-child(n+5) { contain-intrinsic-block-size: 347px; }"
    fi
    manual+=("public/index.html: добавить правило contain-intrinsic-block-size (фрагмент выше)")
  else
    echo "   public/index.html: contain-intrinsic-block-size уже есть — делать нечего"
  fi
fi

# ── Шаг 2. Патчи по файлам (git apply -U1, откат на patch --fuzz=3) ──
echo
echo "════ Шаг 2. Патчи по файлам (git apply -U1, откат на patch --fuzz=3) ════"
for f in "${FILES[@]}"; do
  pf="$(patch_path "$f")"
  if [ ! -f "$pf" ]; then echo "⚠️  $f: нет патча ($pf)"; failed+=("$f"); continue; fi
  if [ ! -f "$f" ] && [ "$f" != "tests/menu-cards.spec.js" ] && [ "$f" != "tests/unit/bonus-grants.test.mjs" ]; then
    echo "⚠️  $f: файла нет в репозитории — пропускаю"; failed+=("$f"); continue
  fi
  # уже применён?
  if git apply -R --check "$pf" >/dev/null 2>&1; then
    echo "➖ $f: уже применён"; done_already+=("$f"); continue
  fi
  if [ "$APPLY" != "1" ]; then
    if git apply --check --ignore-space-change --ignore-whitespace "$pf" >/dev/null 2>&1; then
      echo "✅ $f: применится чисто (dry-run)"; ok+=("$f")
    else
      echo "❗ $f: git apply не проходит — нужен --fuzz или ручная правка (dry-run)"; failed+=("$f")
    fi
    continue
  fi
  mkdir -p "$BACKUP/$(dirname "$f")"; [ -f "$f" ] && cp "$f" "$BACKUP/$f"
  if git apply --ignore-space-change --ignore-whitespace "$pf" >/dev/null 2>&1; then
    echo "✅ $f: применён"; ok+=("$f")
  elif patch -p1 --no-backup-if-mismatch --fuzz=3 -i "$pf" >/dev/null 2>&1; then
    echo "🟡 $f: применён с --fuzz=3 (проверьте diff)"; fuzzy+=("$f")
  else
    ref="$(ref_file "$f")"
    echo "❌ $f: НЕ применился. Готовый файл: ${ref:-<нет в комплекте>}"; failed+=("$f")
  fi
done

# ── Шаг 3. Удаление дубля бэкфилла ──
echo
echo "════ Шаг 3. Удаление дубля бэкфилла ════"
if [ -f scripts/backfill-bonus-grants.mjs ]; then
  if [ "$APPLY" = "1" ]; then
    mkdir -p "$BACKUP/scripts"; cp scripts/backfill-bonus-grants.mjs "$BACKUP/scripts/"
    rm scripts/backfill-bonus-grants.mjs && echo "✅ scripts/backfill-bonus-grants.mjs удалён (логика в initSchema)"
  else
    echo "✅ scripts/backfill-bonus-grants.mjs будет удалён (dry-run)"
  fi
else
  echo "➖ scripts/backfill-bonus-grants.mjs: уже удалён"
fi

# ── Итог ──
echo
echo "════ Итог ════"
echo "чисто: ${#ok[@]}   уже было: ${#done_already[@]}   с fuzz: ${#fuzzy[@]}   FAILED: ${#failed[@]}   вручную: ${#manual[@]}"
if [ ${#failed[@]} -gt 0 ]; then
  echo; echo "Не применились (взять готовое из files/ и сравнить git diff --no-index):"
  for f in "${failed[@]}"; do echo "  • $f"; done
fi
if [ ${#manual[@]} -gt 0 ]; then
  echo; echo "Требует рук:"
  for m in "${manual[@]}"; do echo "  • $m"; done
fi

echo
echo "════ Шаг 4. Обязательная проверка ════"
cat <<'CMD'
npm run build:client     # бамп STATIC_CACHE + ?v= в index.html + сборка бандла (Закон №2)
node --check server.js && node scripts/css-audit.mjs && node scripts/audit-observers.mjs
npm run test:unit        # 52 теста, из них 19 новых (tests/unit/bonus-grants.test.mjs)
PORT=3100 DB_PATH=/tmp/smoke.db node scripts/contract-smoke.mjs
npx playwright test tests/menu-cards.spec.js tests/pwa-responsive.spec.js
CMD

if [ "$APPLY" != "1" ]; then
  echo; echo "Это dry-run. Применить: bash $(basename "${BASH_SOURCE[0]}") --apply"
fi
[ ${#failed[@]} -gt 0 ] && exit 2
[ ${#manual[@]} -gt 0 ] && exit 2
[ "$INSERT_RC" = "2" ] && exit 2
exit 0
