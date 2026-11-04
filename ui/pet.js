document.querySelector('#fox').onclick=()=>window.kanshan.show();
document.querySelector('#bubble').onclick=()=>window.kanshan.show();
document.querySelector('#menu').onclick=()=>window.kanshan.menu();
document.addEventListener('contextmenu',e=>{e.preventDefault();window.kanshan.menu();});
window.kanshan.onChange(()=>{document.querySelector('#bubble').textContent='纸条收好啦，随时回来读。';});
