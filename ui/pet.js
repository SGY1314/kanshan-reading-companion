document.querySelector('#fox').onclick=()=>window.kanshan.show();
document.querySelector('#menu').onclick=()=>window.kanshan.menu();
document.addEventListener('contextmenu',e=>{e.preventDefault();window.kanshan.menu();});
