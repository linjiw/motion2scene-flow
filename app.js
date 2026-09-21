"use strict";
const buttons = document.querySelectorAll("[data-filter]");
buttons.forEach(button => button.addEventListener("click", () => {
  buttons.forEach(b => { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
  let count = 0;
  document.querySelectorAll(".study").forEach(card => {
    card.hidden = button.dataset.filter !== "All" && card.dataset.track !== button.dataset.filter;
    if (!card.hidden) count++;
  });
  document.querySelector("#filter-status").textContent = `${count} studies`;
}));
const ns = "http://www.w3.org/2000/svg";
function element(name, attrs, text) {
  const node = document.createElementNS(ns, name);
  Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,String(v)));
  if (text !== undefined) node.textContent = text;
  return node;
}
const transportPlot = document.querySelector("#transport-plot");
const physicalPlot = document.querySelector("#physical-plot");
let seed = 186;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return (seed + 1) / 4294967297; }
function normal() { return Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random()); }
const samples = Array.from({length:64}, () => {
  const x = normal(), y = normal(), mode = random() < .5 ? -1 : 1;
  return {x,y,tx:mode*1.35 + normal()*.23,ty:normal()*.28,mode};
});
function transport() {
  const tau = Number(document.querySelector("#transport").value)/100;
  document.querySelector("#transport-value").value = tau.toFixed(2);
  transportPlot.replaceChildren();
  transportPlot.append(element("path",{d:"M35 210H413M220 30V210",stroke:"#cbd8ca",fill:"none"}));
  transportPlot.append(element("text",{x:15,y:22,fill:"#52665f","font-size":12},"Action-representation space"));
  [-1,1].forEach(mode=>transportPlot.append(element("ellipse",{cx:220+mode*1.35*72,cy:123,rx:38,ry:27,fill:"none",stroke:mode===1?"#bb6c48":"#55866b","stroke-dasharray":"4 4"})));
  samples.forEach(s=>{
    const x = (1-tau)*s.x+tau*s.tx, y=(1-tau)*s.y+tau*s.ty;
    transportPlot.append(element("circle",{cx:Math.max(12,Math.min(426,220+x*72)),cy:Math.max(38,Math.min(205,123+y*40)),r:3.5,fill:s.mode===1?"#b56c46":"#377657",opacity:.76}));
  });
  transportPlot.append(element("text",{x:20,y:235,fill:"#52665f","font-size":11},"Prescribed noise/data pairs · τ = "+tau.toFixed(2)));
}
function physical() {
  const progress = Number(document.querySelector("#physical").value)/100;
  document.querySelector("#physical-value").value = progress.toFixed(2);
  physicalPlot.replaceChildren();
  physicalPlot.append(element("text",{x:15,y:22,fill:"#52665f","font-size":12},"Physical workspace · top view"));
  physicalPlot.append(element("rect",{x:184,y:87,width:70,height:75,rx:4,fill:"#c29985",opacity:.8}));
  physicalPlot.append(element("text",{x:219,y:130,"text-anchor":"middle",fill:"#50372a","font-size":10},"obstacle"));
  const points = Array.from({length:101},(_,i)=>{const t=i/100;return [30+t*380,184-135*Math.sin(Math.PI*t)];});
  const d = points.map((p,i)=>(i?"L":"M")+p.join(",")).join(" ");
  physicalPlot.append(element("path",{d,stroke:"#51866a","stroke-width":2,fill:"none"}));
  physicalPlot.append(element("path",{d:points.map((p,i)=>(i?"L":"M")+p[0]+","+(184+25*Math.sin(Math.PI*i/100))).join(" "),stroke:"#b1c3b4","stroke-width":1,fill:"none","stroke-dasharray":"5 5"}));
  const p = points[Math.round(progress*100)];
  physicalPlot.append(element("circle",{cx:p[0],cy:p[1],r:10,fill:"#1b5a44",stroke:"#fff","stroke-width":3}));
  physicalPlot.append(element("text",{x:20,y:235,fill:"#52665f","font-size":11},"One schematic candidate · progress = "+progress.toFixed(2)));
}
document.querySelector("#transport").addEventListener("input",transport);
document.querySelector("#physical").addEventListener("input",physical);
document.querySelector("#reset-demo").addEventListener("click",()=>{document.querySelector("#transport").value=45;document.querySelector("#physical").value=35;transport();physical();});
transport(); physical();
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting){
      document.querySelectorAll("aside nav a").forEach(a=>{const current=a.hash==="#"+entry.target.id;a.classList.toggle("current",current);if(current)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");});
    }
  },{rootMargin:"-80px 0px -70% 0px"});
  document.querySelectorAll("h2[id]").forEach(h=>observer.observe(h));
}
let detailStates = [];
window.addEventListener("beforeprint",()=>{detailStates=Array.from(document.querySelectorAll("details"),d=>d.open);document.querySelectorAll("details").forEach(d=>d.open=true);document.querySelectorAll(".study").forEach(c=>c.hidden=false);});
window.addEventListener("afterprint",()=>{document.querySelectorAll("details").forEach((d,i)=>d.open=detailStates[i]);document.querySelector("[data-filter].active")?.click();});
document.querySelector("#print-review").addEventListener("click",()=>window.print());
