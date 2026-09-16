/* public/app/core/review.js — Ф4.1b: кнопка отзыва + maybeAskReview.
Было inline-скрипт index.html (строки ~1403–1422). */
var REVIEW_URL='https://yandex.ru/maps/-/CTHxjIyq';
var SOCIAL_URL='https://t.me/and_coffee39';
$('#reviewBtn').onclick=()=>{window.open(REVIEW_URL,'_blank');toast('Спасибо! Вы лучшие 💙','💙')};
function maybeAskReview(){
 if(!me)return;
 if(!localStorage.getItem('zt_first'))localStorage.setItem('zt_first',String(Date.now()));
 const first=+localStorage.getItem('zt_first');
 if(localStorage.getItem('zt_asked'))return;
 if((me.stamps||0)<3&&(me.cups||0)<3)return;
 if(Date.now()-first<3*86400000)return;
 localStorage.setItem('zt_asked','1');
 setTimeout(()=>toast('Понравилось у нас? Пара секунд — и отзыв на Картах ⭐','⭐',()=>window.open(REVIEW_URL,'_blank')),4000);
}