vw = 'public/app/core/views.js'
th = 'public/app/ui/theme-v2.css'
sw = 'public/sw.js'

# 1) views.js: удаляем базу сплэша (переезжает в СЛОЙ 1)
s = open(vw, encoding='utf8').read()
out = []
for l in s.split('\n'):
    t = l.strip()
    if t.startswith("'#brandSplash") or t.startswith("'@media(min-width:560px){#brandSplash"):
        continue
    out.append(l)
s = '\n'.join(out)

# 2) views.js: шапка резиновая по высоте (modeSeg больше не выливается)
anchor = "'@media(min-width:821px){.topbar{display:grid;"
if anchor in s and '.topbar{height:auto;min-height:' not in s:
    s = s.replace(anchor,
        "'.topbar{height:auto;min-height:calc(var(--topbar-h,64px) + env(safe-area-inset-top,0px))}',\n" + anchor, 1)
open(vw, 'w', encoding='utf8').write(s)

# 3) theme-v2.css: база сплэша в СЛОЕ 1 (без FOUC в WebView)
t = open(th, encoding='utf8').read()
if '#brandSplash' not in t:
    t = t.rstrip() + '''
/* ── Сплэш бренда: база в СЛОЕ 1 (Ф3.54) — без FOUC в медленных WebView ── */
#brandSplash{position:fixed;inset:0;z-index:400;background:#FFFFFF;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
#brandSplashStatic{background:#FFFFFF}
#brandSplash .spInner,#brandSplashStatic .spInner{width:100%;max-width:560px;text-align:center}
#brandSplash .spTitle,#brandSplashStatic .spTitle{font:400 clamp(20px,5.5vw,30px)/1.25 Prata,serif;margin-bottom:6px;overflow-wrap:break-word}
#brandSplash .spSub,#brandSplashStatic .spSub{color:var(--soft);font-size:14px;margin-bottom:22px}
#brandSplash .spBtns,#brandSplashStatic .spBtns{display:grid;grid-template-columns:1fr;gap:12px}
#brandSplash .spBtn,#brandSplashStatic .spBtn{border-radius:22px;padding:22px 16px;font:700 16px Unbounded,sans-serif;box-shadow:var(--sh);width:100%}
#brandSplash .spBtn small,#brandSplashStatic .spBtn small{display:block;font:400 12px Golos Text,sans-serif;margin-top:6px}
#brandSplash .spPizza,#brandSplashStatic .spPizza{border:2px solid #F2D9A5;background:#FFF6E5;color:#6B4E0E}
#brandSplash .spPizza small,#brandSplashStatic .spPizza small{color:#8A6D3B}
#brandSplash .spCoffee,#brandSplashStatic .spCoffee{border:2px solid var(--line);background:#fff;color:var(--ink)}
#brandSplash .spCoffee small,#brandSplashStatic .spCoffee small{color:var(--soft)}
#brandSplash .spBtn .em,#brandSplashStatic .spBtn .em{display:block;font-size:30px;line-height:1;margin-bottom:10px}
#brandSplash .spBtn .bt,#brandSplashStatic .spBtn .bt{display:block;font:700 16px Unbounded,sans-serif}
@media(min-width:560px){#brandSplash .spBtns,#brandSplashStatic .spBtns{grid-template-columns:1fr 1fr}}
'''
    open(th, 'w', encoding='utf8').write(t)

# 4) sw.js: банп STATIC-кэша (WebView заберёт свежий views.js)
w = open(sw, encoding='utf8').read()
w = w.replace('zerno-static-v49', 'zerno-static-v50')
open(sw, 'w', encoding='utf8').write(w)
print('✅ splash → layer 1, topbar height auto, static cache v50')