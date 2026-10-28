// Demo fleet: simulated units shown alongside the real ones so the portal shows
// what a full network looks like. Nothing here touches Supabase. Every demo unit
// id starts with "demo-" and is labelled DEMO wherever it appears.
// Numbers are generated from a seeded pattern (busier in the afternoon, busier
// on Fridays), so they look plausible and stay stable between refreshes.
(function(){
  const SITES = [
    ["demo-01","Circular Quay ferry wharf",-33.8611,151.2112,3.2],
    ["demo-02","Bondi Beach promenade",-33.8908,151.2743,2.6],
    ["demo-03","Manly Corso",-33.7990,151.2856,2.2],
    ["demo-04","Parramatta Square",-33.8150,151.0030,1.8],
    ["demo-05","Newtown, King St bus stop",-33.8968,151.1793,2.4],
    ["demo-06","Darling Harbour boardwalk",-33.8731,151.1990,2.9],
    ["demo-07","Coogee Beach",-33.9205,151.2577,1.6],
    ["demo-08","Kings Cross station",-33.8752,151.2225,2.0],
    ["demo-09","Cronulla Mall",-34.0556,151.1527,1.2]
  ];
  const HOUR = 36e5;
  function rng(seed){ let s = seed >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }
  function hash(str){ let h = 2166136261; for(const c of str){ h ^= c.charCodeAt(0); h = Math.imul(h,16777619); } return h >>> 0; }
  // deposit intensity per hour for a site: afternoon peak, Friday lift, quiet overnight
  function rate(site, t){
    const d = new Date(t), h = d.getHours(), dow = d.getDay();
    const day = h < 6 ? 0.05 : h < 10 ? 0.5 : h < 15 ? 1.0 : h < 19 ? 1.5 : h < 22 ? 0.6 : 0.15;
    return site[4] * day * (dow === 5 ? 1.35 : dow === 0 ? 0.8 : 1);
  }
  // build a 14-day event log for one site, deterministic per site
  const cache = {};
  function events(id){
    const site = SITES.find(s => s[0] === id); if(!site) return [];
    const now = Date.now(), bucket = Math.floor(now / (5*60e3));
    if(cache[id] && cache[id].b === bucket) return cache[id].ev;
    const start = Math.floor((now - 14*24*HOUR) / HOUR) * HOUR;
    const r = rng(hash(id));
    const busyUntil = [0,0,0,0,0,0];
    const ev = [];
    for(let t = start; t < now; t += HOUR){
      const n = Math.round(rate(site, t) * (0.6 + r()*0.8));
      for(let k = 0; k < n; k++){
        const tin = t + r()*HOUR;
        if(tin > now) continue;
        const slot = busyUntil.findIndex(b => b <= tin);
        if(slot < 0) continue;                       // unit full, container goes elsewhere
        const wait = (r() < 0.75 ? r()*0.9 : 0.9 + r()*7) * HOUR;  // most go inside the hour
        const tout = tin + wait;
        ev.push({slot: slot+1, state: 1, changed_at: new Date(tin).toISOString()});
        if(tout < now) ev.push({slot: slot+1, state: 0, changed_at: new Date(tout).toISOString()});
        busyUntil[slot] = tout;
      }
    }
    ev.sort((a,b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
    cache[id] = {b: bucket, ev};
    return ev;
  }
  function slotsAt(id, t){
    const s = [0,0,0,0,0,0];
    for(const e of events(id)){ if(Date.parse(e.changed_at) > t) break; s[e.slot-1] = e.state; }
    return s;
  }
  function packets(id, n){
    const site = SITES.find(s => s[0] === id); if(!site) return [];
    const r = rng(hash(id) ^ 0x9e37), out = [], now = Date.now();
    const step = 15*60e3, last = Math.floor(now/step)*step - Math.floor(r()*4)*60e3;
    for(let i = 0; i < n; i++){
      const t = last - i*step;
      const h = new Date(t).getHours();
      const vb = Math.round(3950 + 180*Math.sin((h-13)/24*2*Math.PI) + r()*40);
      out.push({id: -i, unit_id: id, src: "lte", received_at: new Date(t).toISOString(),
                slots: JSON.stringify(slotsAt(id, t)), vbat_mv: vb, rssi: -78 - Math.round(r()*14)});
    }
    return out;
  }
  function units(){
    const now = Date.now();
    return SITES.map(s => ({unit_id: s[0], label: s[1], lat: s[2], lon: s[3], acc_m: 6,
      last_seen: new Date(Math.floor(now/(15*60e3))*15*60e3).toISOString(),
      located_at: new Date(now - 9*24*HOUR).toISOString(), demo: true}));
  }
  window.DEMO = {isDemo: id => String(id).startsWith("demo-"), units, packets, events, slotsAt};
})();
