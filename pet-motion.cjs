function placePet({cursor,offset,size,area,snap=false}){
 const maxX=area.x+Math.max(0,area.width-size.width),maxY=area.y+Math.max(0,area.height-size.height);
 let x=Math.round(Math.max(area.x,Math.min(maxX,cursor.x-offset.x))),y=Math.round(Math.max(area.y,Math.min(maxY,cursor.y-offset.y)));
 let edge='';
 if(snap){const distances=[['left',x-area.x],['right',maxX-x],['top',y-area.y],['bottom',maxY-y]].sort((a,b)=>a[1]-b[1]);if(distances[0][1]<=22){edge=distances[0][0];if(edge==='left')x=area.x;if(edge==='right')x=maxX;if(edge==='top')y=area.y;if(edge==='bottom')y=maxY;}}
 return {x,y,edge};
}
module.exports={placePet};
