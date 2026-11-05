const {test}=require('node:test');
const assert=require('node:assert/strict');
const {placePet}=require('../pet-motion.cjs');
test('drag stays on the active monitor including negative desktop coordinates',()=>{
 const args={cursor:{x:-2500,y:-1000},offset:{x:100,y:90},size:{width:260,height:326},area:{x:-1920,y:0,width:1920,height:1040}};
 assert.deepEqual(placePet(args),{x:-1920,y:0,edge:''});
 assert.deepEqual(placePet({...args,cursor:{x:800,y:2000}}),{x:-260,y:714,edge:''});
});
test('edge release snaps only near a work-area boundary',()=>{
 const args={offset:{x:100,y:90},size:{width:260,height:326},area:{x:0,y:0,width:1920,height:1040},snap:true};
 assert.deepEqual(placePet({...args,cursor:{x:112,y:400}}),{x:0,y:310,edge:'left'});
 assert.equal(placePet({...args,cursor:{x:1000,y:400}}).edge,'');
 assert.equal(placePet({...args,cursor:{x:1752,y:400}}).edge,'right');
 assert.equal(placePet({...args,cursor:{x:500,y:92}}).edge,'top');
});
