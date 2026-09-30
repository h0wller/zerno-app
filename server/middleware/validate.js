// server/middleware/validate.js
// Лёгкий контракт-валидатор тел запросов. Ноль внешних зависимостей.
//
// Задача — не заменить JSON Schema, а поставить дешёвый барьер против слопа в API:
// неизвестные поля, отсутствующие required, не тот тип. Схемы — source of truth
// для docs/openapi.yaml.
//
// Внедряется инкрементально: сначала только auth-роуты (login/register/setup-pin).
// Для волатильных роутов (/orders, /chat/send) — opts.strict:false, чтобы фронт
// не отваливался на каждом новом поле.

const TYPE_CHECK = {
  string:  (v) => typeof v === 'string',
  number:  (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  object:  (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array:   (v) => Array.isArray(v)
};

function describeType(expected, actual) {
  if (Array.isArray(actual)) return expected + ' (получен array)';
  if (actual === null) return expected + ' (получен null)';
  return expected + ' (получен ' + typeof actual + ')';
}

export function validate(schema, opts = {}) {
  const strict = opts.strict !== false;
  const fields = Object.entries(schema);

  return function validateBody(req, res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Тело запроса должно быть объектом' });
    }

    for (const [key, rule] of fields) {
      const value = body[key];

      if (value === undefined || value === null || value === '') {
        if (rule.required) {
          return res.status(400).json({ error: 'Поле «' + key + '» обязательно' });
        }
        continue;
      }

      const check = TYPE_CHECK[rule.type];
      if (check && !check(value)) {
        return res.status(400).json({ error: 'Поле «' + key + '»: ожидалось ' + describeType(rule.type, value) });
      }

      if (rule.max && typeof value === 'string' && value.length > rule.max) {
        return res.status(400).json({ error: 'Поле «' + key + '»: длина превышает ' + rule.max });
      }
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        return res.status(400).json({ error: 'Поле «' + key + '»: значение меньше ' + rule.min });
      }
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        return res.status(400).json({ error: 'Поле «' + key + '»: значение больше ' + rule.max });
      }
      if (rule.enum && !rule.enum.includes(value)) {
        return res.status(400).json({ error: 'Поле «' + key + '»: допустимые значения — ' + rule.enum.join(', ') });
      }
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        return res.status(400).json({ error: 'Поле «' + key + '»: не соответствует формату' });
      }
    }

    if (strict) {
      const allowed = new Set(Object.keys(schema));
      for (const key of Object.keys(body)) {
        if (!allowed.has(key) && !key.startsWith('_')) {
          return res.status(400).json({ error: 'Неизвестное поле «' + key + '»' });
        }
      }
    }

    next();
  };
}
