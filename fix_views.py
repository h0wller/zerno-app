import re
p = 'public/app/core/views.js'
t = open(p, encoding='utf8').read()
lines = t.split('\n')
sels = [
  '[data-brand="delivery"] .topbar .brand .mark{',
  '[data-brand="delivery"] .topbar .brand .mark img,',
  '[data-brand="delivery"] .topbar .brand b,',
]
for sel in sels:
    idxs = [i for i, l in enumerate(lines) if sel in l]
    if len(idxs) > 1:
        for i in reversed(idxs[1:]):   # оставляем ПЕРВОЕ вхождение (блок Ф3.46), удаляем хвост
            del lines[i]
        print('✅ удалено дублей:', sel, len(idxs) - 1)
open(p, 'w', encoding='utf8').write('\n'.join(lines))
print('готово')