import re
IDX='public/index.html'; TH='public/app/ui/theme-v2.css'; VW='public/app/core/views.js'

html=open(IDX,encoding='utf8').read(); before=len(html)
# брендовые оверрайды и база, которые теперь живут в views.js / theme-v2
html=re.sub(r'\s*\[data-brand="coffee"\] \.brand \.mark \{[^}]*\}','',html)
html=re.sub(r'\s*\[data-brand="delivery"\] \.cartPanel\{[^}]*\}','',html)
html=re.sub(r'\s*\[data-brand="delivery"\] \.cartPanel \.cartItem\{[^}]*\}','',html)
html=re.sub(r'\s*\[data-brand="delivery"\] \.cartPanel \.qty button\{[^}]*\}','',html)
html=re.sub(r'\s*\.topbar \.brand \.mark\{[^}]*\}','',html)
html=re.sub(r'\s*\.topbar \.brand \.mark img,\.topbar \.brand \.mark svg\{[^}]*\}','',html)
# тикер: база уйдёт в theme-v2, брендовые цвета уже в views.js
html=re.sub(r'\s*\.ticker\{[^}]*\}','',html)
html=re.sub(r'\s*\.ticker span\{[^}]*\}','',html)
html=re.sub(r'\s*\[data-brand="[a-z]+"\] #tickerTrack\s*,\s*\[data-brand="[a-z]+"\] #ticker\{[^}]*\}','',html)
html=re.sub(r'\s*\[data-brand="[a-z]+"\] #tickerTrack span::after\{[^}]*\}','',html)
open(IDX,'w',encoding='utf8').write(html)
print('index.html: минус байт =', before-len(html))

th=open(TH,encoding='utf8').read()
if '#tickerTrack{' not in th:
    th+='''
/* ── Тикер: база (брендовые цвета — СЛОЙ 2, views.js) ── */
.ticker{overflow:hidden;max-width:100%;height:30px;line-height:30px;display:flex;align-items:center;margin-top:-3px;position:relative;z-index:1}
#tickerTrack{display:inline-flex;align-items:center;height:30px;white-space:nowrap;width:max-content;backface-visibility:hidden;animation:zt-marquee 40s linear infinite}
#tickerTrack span{flex:0 0 auto;display:inline-flex;align-items:center;gap:.5rem;padding:0 1.2rem;font:600 11px/30px "Unbounded",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
#tickerTrack span::after{content:"〜";margin-left:1.4rem;color:var(--azure,#3E8FD0)}
@keyframes zt-marquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
@media(prefers-reduced-motion:reduce){#tickerTrack{animation:none}}
@media(max-width:400px){#tickerTrack span{font-size:10px;padding:.35rem 1rem}}
'''
    open(TH,'w',encoding='utf8').write(th); print('theme-v2.css: база тикера добавлена')

vw=open(VW,encoding='utf8').read()
for pat in [r"\s*'\.ticker\{[^']*',", r"\s*'#tickerTrack\{[^']*',", r"\s*'#tickerTrack span\{[^']*',",
            r"\s*'#tickerTrack span::after\{[^']*',", r"\s*'@keyframes zt-marquee\{[^']*',",
            r"\s*'@media\(prefers-reduced-motion:reduce\)\{#tickerTrack\{animation:none\}\}',",
            r"\s*'@media\(max-width:400px\)\{#tickerTrack span\{[^']*',"]:
    vw=re.sub(pat,'',vw)
add=[]
if '@media(max-width:360px){[data-brand="coffee"] .topbar .brand .mark' not in vw:
    add.append("'@media(max-width:360px){[data-brand=\"coffee\"] .topbar .brand .mark{width:32px;height:32px}}',")
if '[data-brand="delivery"] .cartPanel .cartItem{' not in vw:
    add.append("'[data-brand=\"delivery\"] .cartPanel .cartItem{border-bottom:1.5px dashed rgba(58,42,28,.3);color:#3A2A1C;font-weight:600}',")
anchor="'@media(max-width:690px){.venueToggle .vt-label{display:none}.venueToggle{padding:0 10px;gap:4px}}',"
if add and anchor in vw:
    vw=vw.replace(anchor, anchor+"\n"+"\n".join(add),1)
vw=vw.replace("'[data-brand=\"delivery\"] #cartPanel,[data-brand=\"delivery\"] .cartPanel{background:var(--fr-rice);border:2px solid var(--fr-choc)}',",
              "'[data-brand=\"delivery\"] #cartPanel,[data-brand=\"delivery\"] .cartPanel{background:var(--fr-rice);border:3px solid var(--fr-choc);border-bottom:none}',")
open(VW,'w',encoding='utf8').write(vw)
print('views.js: база тикера удалена, брендовые дельты синхронизированы')