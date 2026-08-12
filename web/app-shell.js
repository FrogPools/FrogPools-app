/* FrogPools app shell — shared nav, ticker, footer, helpers (injected on every app page) */
(function(){
  var page=document.body.getAttribute('data-page')||'explore';
  function on(p){return p===page?' on':'';}

  // verified badge symbol
  var defs='<svg width="0" height="0" style="position:absolute"><symbol id="chk" viewBox="0 0 24 24"><path fill="#7BAA12" d="M12 2l2.4 1.7 2.9-.3 1.2 2.7 2.7 1.2-.3 2.9L24 12l-1.7 2.4.3 2.9-2.7 1.2-1.2 2.7-2.9-.3L12 22l-2.4-1.7-2.9.3-1.2-2.7-2.7-1.2.3-2.9L2 12l1.7-2.4-.3-2.9 2.7-1.2 1.2-2.7 2.9.3z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2-1.3 1.3 3.5 3.5 6-6-1.3-1.3z"/></symbol></svg>';

  var nav='<nav class="nav"><div class="wrap nav-in">'+
    '<a class="brand" href="index.html"><span class="fm"></span> FrogPools</a>'+
    '<div class="nlinks">'+
      '<a class="'+on('explore').trim()+'" href="app.html">Explore</a>'+
      '<a class="'+on('collections').trim()+'" href="collections.html">Collections</a>'+
      '<a class="'+on('trending').trim()+'" href="trending.html">Trending</a>'+
      '<a class="'+on('activity').trim()+'" href="activity.html">Activity</a>'+
      '<a class="'+on('launch').trim()+'" href="launch.html">Launch</a>'+
      '<a href="index.html">Earn</a>'+
    '</div>'+
    '<div class="nav-r">'+
      '<span class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> Search pools</span>'+
      '<span class="wallet"><span class="av"></span> 0x..6386</span>'+
      '<button class="btn btn-lime" id="connect" type="button">Connect wallet</button>'+
    '</div>'+
  '</div></nav>';

  var foot='<footer class="foot"><div class="wrap foot-in">'+
    '<div class="tag"><a class="brand" href="index.html"><span class="fm"></span> FrogPools</a><p>The fast, self-custodial liquidity layer for pools.trade.</p></div>'+
    '<div><h4>Protocol</h4><ul><li><a href="app.html">Explore</a></li><li><a href="collections.html">Collections</a></li><li><a href="trending.html">Trending</a></li><li><a href="activity.html">Activity</a></li><li><a href="launch.html">Launch</a></li></ul></div>'+
    '<div><h4>pools.trade</h4><ul><li><a href="https://pools.trade/" target="_blank" rel="noopener">About the chain ↗</a></li><li><a href="#" target="_blank" rel="noopener">Block explorer ↗</a></li><li><a href="https://x.com/" target="_blank" rel="noopener">X / Twitter ↗</a></li></ul></div>'+
    '<div><h4>About</h4><ul><li><a href="index.html">Overview</a></li><li><a href="app.html">Router</a></li><li><a href="index.html">Earn</a></li><li><a href="index.html">Docs ↗</a></li></ul></div>'+
  '</div><div class="wrap foot-bot"><span>© 2026 FrogPools</span><span>Built on Robinhood Chain</span></div></footer>';

  var ticker='<div class="ticker"><div class="track" id="fp-ticker"></div></div>';

  // inject
  var mp=document.getElementById('nav-mount'); if(mp) mp.outerHTML=defs+nav;
  var fm=document.getElementById('foot-mount'); if(fm) fm.outerHTML=foot+ticker;

  // build ticker
  var t=[['$LILYPAD','$0.0142','up'],['$SWAMP','$0.0039','up'],['$DROPLET','$0.0071','down'],['WETH','$3,412','up'],['USDG','$1.00','down'],['$FLYCATCH','$0.0008','up'],['pools.trade','—','up'],['$FROG','soon','up']];
  var te=document.getElementById('fp-ticker');
  if(te){var one=t.map(function(x){return '<span class="it"><span class="sym">'+x[0]+'</span> '+x[1]+' <span class="'+x[2]+'">'+(x[2]==='up'?'▲':'▼')+'</span></span><span class="sep">/</span>';}).join('');te.innerHTML=one+one;}

  // segmented toggles (visual)
  document.querySelectorAll('.seg').forEach(function(seg){seg.addEventListener('click',function(e){var s=e.target.closest('span');if(!s)return;seg.querySelectorAll('span').forEach(function(x){x.classList.remove('on');});s.classList.add('on');});});
  var c=document.getElementById('connect');if(c)c.addEventListener('click',function(e){e.preventDefault();});

  // helper: sparkline path generator exposed for pages
  window.fpSpark=function(seed,w,h){w=w||110;h=h||30;var pts=[],n=24;for(var i=0;i<n;i++){var v=(h*0.18)+(h*0.5)*(0.5+0.5*Math.sin(i/3+seed))+((i*seed*13)%5);pts.push((i/(n-1)*w).toFixed(1)+','+(h-Math.max(2,Math.min(h-2,v))).toFixed(1));}return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><polyline points="'+pts.join(' ')+'" fill="none" stroke="#8CBE1B" stroke-width="1.6"/></svg>';};
})();
