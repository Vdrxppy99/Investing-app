'use strict';
const cvar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
/* validated categorical palette (fixed order; gray only for "Other") */
const CAT = ['#3987e5','#199e70','#c98500','#9085e9','#d55181','#d95926'];
document.documentElement.dataset.theme = (function(){ try{const t=localStorage.getItem('pt_theme'); return t?JSON.parse(t):'dark';}catch(e){return 'dark';} })();
if(window.Chart){ Chart.defaults.font.family = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif"; Chart.defaults.font.weight = 500; }
