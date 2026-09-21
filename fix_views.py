import re
p = 'public/app/core/views.js'
lines = open(p, encoding='utf8').read().split('\n')

# Правила, которые нужно "обобщить" (delivery-скоуп → общий .card)
REPLACEMENTS = {
    # edBtn: любой вариант → единый
    r"['\"]#deliveryGrid\s+\.edBtn\{[^'\"]*cursor:pointer\}['\"],?":
        "'.card .edBtn{position:absolute;top:8px;right:8px;z-index:3;width:34px;height:34px;border-radius:10px;border:1.5px solid var(--line);background:#fff;font-size:16px;cursor:pointer}',",

    # stopbadge
    r"['\"]#deliveryGrid\s+\.stopbadge\{[^'\"]*padding:3px 8px\}['\"],?":
        "'.card .stopbadge{position:absolute;top:10px;right:10px;left:auto;z-index:2;background:#D63939;color:#fff;font:800 10px \"Golos Text\",sans-serif;letter-spacing:.06em;border-radius:8px;padding:3px 8px}',",

    # stopbadge editing
    r"['\"]body\.editing\s+#deliveryGrid\s+\.stopbadge\{right:52px\}['\"],?":
        "'body.editing .card .stopbadge{right:52px}',",

    # .card .media (delivery-скоуп)
    r"['\"]#deliveryGrid\s+\.card\s+\.media\{position:relative\}['\"],?":
        "'.card .media{position:relative}',",

    # .card.stopped
    r"['\"]#deliveryGrid\s+\.card\.stopped\{opacity:\.75\}['\"],?":
        "'.card.stopped{opacity:.75}',",
}

out = []
seen_rules = set()
for l in lines:
    t = l.strip()
    replaced = False
    for pat, new in REPLACEMENTS.items():
        if re.match(pat, t):
            # дедуп: добавляем только первое вхождение обобщённого правила
            if new not in seen_rules:
                out.append(new)
                seen_rules.add(new)
            replaced = True
            break
    if not replaced:
        # дедуп уже существующих общих правил
        if t in seen_rules and t.startswith("'") and '{' in t:
            continue
        if t.startswith("'") and '{' in t:
            seen_rules.add(t)
        out.append(l)

open(p, 'w', encoding='utf8').write('\n'.join(out))
print('✅ edBtn/stopbadge/media/stopped обобщены до .card, дубли удалены')
print(f'   правил в обобщённом виде: {len(seen_rules)}')