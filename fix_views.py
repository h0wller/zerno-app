p = 'public/app/core/views.js'
src = open(p, encoding='utf8').read()

if 'grid-template-columns:1fr auto 1fr' in src:
    print('⏭️ уже добавлено, пропускаю')
else:
    i = src.index('var rules = [')
    j = src.index('];', i)
    NEW = (
        "'@media(min-width:821px){.topbar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}"
        ".topbar .venueWrap{grid-column:1;grid-row:1;justify-self:start;order:0}"
        ".topbar .brand{grid-column:2;grid-row:1;justify-self:center;order:0;flex:none;max-width:100%}"
        ".topbar #profileTopBtn{grid-column:3;grid-row:1;justify-self:end;order:0;margin-left:0}"
        ".topbar #modeSeg{grid-column:1/-1;grid-row:2}}',\n"
        "'.ticker{margin-top:-1px}',\n"
        "'@media(max-width:690px){.venueToggle .vt-label{display:none}.venueToggle{padding:0 10px;gap:4px}}',\n"
    )
    src = src[:j] + NEW + src[j:]
    open(p, 'w', encoding='utf8').write(src)
    print('✅ добавлено: grid-центр ≥821px, шов тикера -1px, «Сменить» скрыт ≤690px')