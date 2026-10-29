// scripts/lib/bonus-forensics.mjs — общая логика диагностики/восстановления приветственного бонуса.
// Принимает объект БД (better-sqlite3) — сам ничего не открывает и не пишет.

/** Запись истории, указывающая на подтверждение профиля (для диагностики; на классификацию не влияет). */
export const VERIFY_SQL = "(a LIKE '%активирован%' OR a LIKE '%верифицирован%' OR a LIKE '%подтверждён%' OR a LIKE '%Telegram привязан%')";

/** Любые признаки работы лояльности в истории: штампы, начисления, подарки, списания. */
const LOYALTY_SQL = "(a LIKE 'Штамп%' OR a LIKE 'Начислено%' OR a LIKE '%штамп%' OR a LIKE '%Списан%' OR a LIKE '%списан%' OR a LIKE '🎁%')";

export const backfillTsOf = (db) => (db.prepare("SELECT value FROM meta WHERE key='bonus_grants_backfilled'").get() || {}).value || null;

/**
 * Классификация приветственных отметок клиента по ДОКАЗАТЕЛЬСТВАМ, а не по самому факту отметки:
 *   unrelated    — не гость или профиль не подтверждён: бонус сейчас не положен;
 *   not_marked   — отметок signup/qr нет: бэкфилл его не блокирует (искать причину в другом месте);
 *   real         — есть доказательство реального начисления (отметка не от бэкфилла, бонус в истории, персональный промокод…);
 *   unclear      — отметка от бэкфилла, но в истории есть следы лояльности (возможен бонус старой схемы) — только ручной разбор;
 *   false_marks  — отметки поставлены только бэкфиллом и НИКАКИХ следов начисления/использования нет.
 * ВАЖНО: false_marks ≠ «обязательно положен бонус». Это лишь «отметка ничего не доказывает»; положен ли бонус давним
 * неактивным клиентам — бизнес-решение, поэтому массово такие профили не чинятся.
 * @returns {{cls: string, reasons: string[], marks: {kind: string, ts: string}[]}}
 */
export function classify(db, c, backfillTs) {
  const reasons = [];
  const marks = db.prepare("SELECT kind, ts FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')").all(c.id);
  if ((c.role || 'guest') !== 'guest') return { cls: 'unrelated', reasons: ['роль не guest'], marks };
  if (!c.verified) return { cls: 'unrelated', reasons: ['профиль не подтверждён'], marks };
  if (!marks.length) return { cls: 'not_marked', reasons: ['отметок signup/qr нет'], marks };
  if (!backfillTs) return { cls: 'real', reasons: ['бэкфилл не выполнялся — отметки поставлены штатными начислениями'], marks };

  if (!marks.every((m) => m.ts === backfillTs)) reasons.push('есть отметка не от бэкфилла (штатное начисление)');
  if (db.prepare("SELECT 1 FROM history WHERE cid=? AND a LIKE '🎁 Бонус «%' LIMIT 1").get(c.id)) reasons.push('бонус есть в истории');
  if (c.cups || c.stamps || c.free) reasons.push('есть чашки/штампы/подарки');
  if (db.prepare('SELECT 1 FROM promos WHERE owner=? LIMIT 1').get(c.id)) reasons.push('есть персональный промокод');
  if (db.prepare('SELECT 1 FROM promo_use WHERE cid=? LIMIT 1').get(c.id)) reasons.push('использовал промокод');
  if (reasons.length) return { cls: 'real', reasons, marks };

  if (db.prepare(`SELECT 1 FROM history WHERE cid=? AND ${LOYALTY_SQL} LIMIT 1`).get(c.id)) {
    return { cls: 'unclear', reasons: ['в истории есть следы лояльности (штампы/подарки/списания) — возможен бонус старой схемы'], marks };
  }
  return { cls: 'false_marks', reasons: ['отметки только от бэкфилла, следов начисления и использования нет'], marks };
}

export const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + '.').join(' ') || '—';
